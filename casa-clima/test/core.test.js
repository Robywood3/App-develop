import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hub } from '../src/core/hub.js';
import { AutomationEngine, evaluateCondition } from '../src/core/automation.js';
import { CasaClima } from '../src/core/casaclima.js';
import { sceneCalls } from '../src/core/scenes.js';
import { parsePackage } from '../src/core/packages.js';
import { parseDuration, slugify } from '../src/core/util.js';
import { digestAuthorization } from '../src/core/http.js';
import { parseDaikin } from '../src/integrations/daikin.js';
import { parseSensors } from '../src/integrations/webhook.js';
import { parseAuthInput } from '../src/integrations/manager.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Climatizzatore finto che registra i comandi ricevuti. */
function fakeClimate(hub, entity_id, { modes, area, state = 'off', temperature = 20, current = 19 }) {
  const calls = [];
  const owner = {
    async handleService(id, service, data) {
      calls.push({ service, ...data });
      const st = hub.getState(id);
      let next = st.state;
      const attrs = { ...st.attributes };
      if (service === 'set_hvac_mode') next = data.hvac_mode;
      if (service === 'set_temperature') { attrs.temperature = data.temperature; if (data.hvac_mode) next = data.hvac_mode; }
      hub.setState(id, next, attrs);
    }
  };
  hub.registerEntity({ entity_id, owner, area, name: entity_id });
  hub.setState(entity_id, state, { hvac_modes: modes, temperature, current_temperature: current, min_temp: 5, max_temp: 30, target_temp_step: 0.5 });
  return calls;
}

test('utilità', () => {
  assert.equal(slugify('Camera da Letto è'), 'camera_da_letto_e');
  assert.equal(parseDuration('00:01:30'), 90);
  assert.equal(parseDuration({ minutes: 2 }), 120);
  assert.equal(parseDuration(15), 15);
});

test('hub: stati, eventi e servizi', async () => {
  const hub = new Hub();
  const events = [];
  hub.on('state_changed', (e) => events.push(e));
  let called = null;
  hub.registerEntity({ entity_id: 'switch.prova', name: 'Prova', owner: { handleService: (id, s) => { called = s; } } });
  hub.setState('switch.prova', 'off');
  hub.setState('switch.prova', 'off'); // nessun cambiamento
  hub.setState('switch.prova', 'on');
  assert.equal(events.length, 2);
  assert.equal(hub.getState('switch.prova').attributes.friendly_name, 'Prova');
  await hub.callService('switch', 'turn_off', { entity_id: 'switch.prova' });
  assert.equal(called, 'turn_off');
  await assert.rejects(() => hub.callService('light', 'turn_on', { entity_id: 'switch.prova' }));
  await assert.rejects(() => hub.callService('switch', 'turn_on', { entity_id: 'switch.nessuno' }));
});

test('condizioni stile Home Assistant', () => {
  const hub = new Hub();
  hub.registerEntity({ entity_id: 'sensor.t' });
  hub.setState('sensor.t', 22.5);
  assert.equal(evaluateCondition(hub, { condition: 'numeric_state', entity_id: 'sensor.t', above: 20, below: 23 }), true);
  assert.equal(evaluateCondition(hub, { condition: 'not', conditions: [{ condition: 'state', entity_id: 'sensor.t', state: '22.5' }] }), false);
  const at = (h, m) => new Date(2026, 0, 5, h, m); // lunedì
  assert.equal(evaluateCondition(hub, { condition: 'time', after: '22:00', before: '06:00' }, at(23, 0)), true);
  assert.equal(evaluateCondition(hub, { condition: 'time', after: '22:00', before: '06:00' }, at(12, 0)), false);
  assert.equal(evaluateCondition(hub, { condition: 'time', weekday: ['sat', 'sun'] }, at(12, 0)), false);
});

test('automazione: trigger state con "for", condizioni e azioni', async () => {
  const hub = new Hub();
  const engine = new AutomationEngine(hub);
  const done = [];
  hub.registerService('test', 'fire', (d) => done.push(d.v));
  hub.registerEntity({ entity_id: 'binary_sensor.finestra' });
  hub.setState('binary_sensor.finestra', 'off');
  engine.load([{
    id: 'prova',
    trigger: [{ trigger: 'state', entity_id: 'binary_sensor.finestra', to: 'on', for: 0.15 }],
    action: [{ action: 'test.fire', data: { v: 1 } }, { delay: 0.01 }, { service: 'test.fire', data: { v: 2 } }]
  }, {
    alias: 'Soglia',
    triggers: [{ platform: 'numeric_state', entity_id: 'binary_sensor.finestra', above: 5 }],
    actions: [{ action: 'test.fire', data: { v: 99 } }]
  }]);
  assert.equal(engine.errors.length, 0);
  // apertura troppo breve: non scatta
  hub.setState('binary_sensor.finestra', 'on');
  await sleep(50);
  hub.setState('binary_sensor.finestra', 'off');
  await sleep(200);
  assert.deepEqual(done, []);
  // apertura lunga: scatta
  hub.setState('binary_sensor.finestra', 'on');
  await sleep(300);
  assert.deepEqual(done, [1, 2]);
  assert.equal(hub.getState('automation.prova').attributes.last_triggered !== null, true);
  // disattivata: non scatta
  await hub.callService('automation', 'turn_off', { entity_id: 'automation.prova' });
  hub.setState('binary_sensor.finestra', 'off');
  hub.setState('binary_sensor.finestra', 'on');
  await sleep(250);
  assert.deepEqual(done, [1, 2]);
  engine.shutdown();
});

test('automazione: errori di configurazione segnalati', () => {
  const hub = new Hub();
  const engine = new AutomationEngine(hub);
  engine.load([{ id: 'x', trigger: [{ platform: 'mqtt' }], action: [{ action: 'a.b' }] }, { id: 'y', trigger: [] }]);
  assert.equal(engine.automations.length, 0);
  assert.equal(engine.errors.length, 2);
  engine.shutdown();
});

test('time_pattern', () => {
  const hub = new Hub();
  const engine = new AutomationEngine(hub);
  engine.load([{ id: 'tp', trigger: [{ trigger: 'time_pattern', minutes: '/5' }], action: [{ action: 'x.y' }] }]);
  const a = engine.automations[0];
  assert.equal(a.patternMatch(a.triggers[0], 10 * 60), true);
  assert.equal(a.patternMatch(a.triggers[0], 10 * 60 + 1), false);
  assert.equal(a.patternMatch(a.triggers[0], 11 * 60), false);
  engine.shutdown();
});

test('Casa-Clima: profili, ruoli per stagione e comandi solo se necessari', async () => {
  const hub = new Hub();
  const tado = fakeClimate(hub, 'climate.tado_soggiorno', { modes: ['off', 'heat', 'auto'], area: 'Soggiorno', state: 'auto' });
  const daikin = fakeClimate(hub, 'climate.daikin_soggiorno', { modes: ['off', 'heat', 'cool', 'auto', 'dry', 'fan_only'], area: 'Soggiorno', state: 'off' });
  const camera = fakeClimate(hub, 'climate.daikin_camera', { modes: ['off', 'heat', 'cool'], area: 'Camera', state: 'off' });
  const cc = new CasaClima(hub, {});
  cc.load({ season: { mode: 'heat' } });
  const rooms = cc.rooms();
  assert.deepEqual(rooms.map((r) => r.name).sort(), ['Camera', 'Soggiorno']);

  await cc.setProfile('comfort');
  // in inverno scalda il termostato, il Daikin del soggiorno resta spento; in camera scalda il Daikin
  assert.equal(hub.getState('climate.tado_soggiorno').state, 'heat');
  assert.equal(hub.getState('climate.tado_soggiorno').attributes.temperature, 21);
  assert.equal(hub.getState('climate.daikin_soggiorno').state, 'off');
  assert.equal(hub.getState('climate.daikin_camera').state, 'heat');
  assert.equal(daikin.length, 0);

  // riapplicare lo stesso profilo non manda comandi
  const before = tado.length + camera.length;
  await cc.setProfile('comfort');
  assert.equal(tado.length + camera.length, before);

  // estate: raffrescano i Daikin, il termostato si spegne
  await cc.setSeason('cool');
  assert.equal(hub.getState('climate.daikin_soggiorno').state, 'cool');
  assert.equal(hub.getState('climate.daikin_soggiorno').attributes.temperature, 25);
  assert.equal(hub.getState('climate.tado_soggiorno').state, 'off');

  // regolazione manuale della stanza
  await cc.setRoomTemperature('soggiorno', 24);
  assert.equal(hub.getState('climate.daikin_soggiorno').attributes.temperature, 24);
  assert.equal(cc.summary().rooms.find((r) => r.id === 'soggiorno').override, 24);

  // programma: i termostati tornano al loro programma
  await cc.setSeason('heat');
  await cc.setProfile('programma');
  assert.equal(hub.getState('climate.tado_soggiorno').state, 'auto');

  await cc.setProfile('spento');
  assert.ok(['climate.tado_soggiorno', 'climate.daikin_soggiorno', 'climate.daikin_camera'].every((id) => hub.getState(id).state === 'off'));
  cc.shutdown();
});

test('Casa-Clima: pausa con finestra aperta e ripristino', async () => {
  const hub = new Hub();
  fakeClimate(hub, 'climate.camera', { modes: ['off', 'heat', 'cool'], area: 'Camera', state: 'off' });
  hub.registerEntity({ entity_id: 'binary_sensor.finestra_camera', area: 'Camera', device_class: 'window' });
  hub.setState('binary_sensor.finestra_camera', 'off');
  const cc = new CasaClima(hub, {});
  cc.load({ season: { mode: 'heat' }, window: { enabled: true, delay: 0.1, restore_delay: 0.1 } });
  await cc.setProfile('comfort');
  assert.equal(hub.getState('climate.camera').state, 'heat');
  hub.setState('binary_sensor.finestra_camera', 'on');
  await sleep(250);
  assert.equal(hub.getState('climate.camera').state, 'off');
  assert.equal(cc.summary().rooms[0].paused, true);
  hub.setState('binary_sensor.finestra_camera', 'off');
  await sleep(250);
  assert.equal(hub.getState('climate.camera').state, 'heat');
  assert.equal(cc.summary().rooms[0].paused, false);
  cc.shutdown();
});

test('Casa-Clima: stagione automatica dalla temperatura esterna', () => {
  const hub = new Hub();
  hub.registerEntity({ entity_id: 'sensor.meteo_temperatura' });
  hub.setState('sensor.meteo_temperatura', 8);
  const cc = new CasaClima(hub, {});
  cc.load({});
  assert.equal(cc.state.effective_season, 'heat');
  hub.setState('sensor.meteo_temperatura', 20); // zona neutra: resta com'era
  cc.evaluateSeason(false);
  assert.equal(cc.state.effective_season, 'heat');
  hub.setState('sensor.meteo_temperatura', 29);
  cc.evaluateSeason(false);
  assert.equal(cc.state.effective_season, 'cool');
  cc.shutdown();
});

test('scene: stato desiderato -> servizi', () => {
  assert.deepEqual(sceneCalls('cover.t', 'closed').map((c) => c.service), ['close_cover']);
  assert.deepEqual(sceneCalls('light.l', { state: 'on', brightness_pct: 30 })[0].data, { entity_id: 'light.l', brightness_pct: 30 });
  assert.deepEqual(sceneCalls('climate.c', { state: 'heat', temperature: 21 })[0], { domain: 'climate', service: 'set_temperature', data: { entity_id: 'climate.c', hvac_mode: 'heat', temperature: 21 } });
  assert.throws(() => sceneCalls('camera.x', 'on'));
});

test('pacchetto YAML di esempio valido', async () => {
  const { readFile } = await import('node:fs/promises');
  const doc = parsePackage(await readFile(new URL('../config/packages/casa-clima.yaml', import.meta.url), 'utf8'), 'casa-clima.yaml');
  assert.ok(doc.casa_clima.profiles.comfort);
  const hub = new Hub();
  const engine = new AutomationEngine(hub);
  engine.load(doc.automations);
  assert.deepEqual(engine.errors, []);
  assert.ok(engine.automations.length >= 5);
  engine.shutdown();
  assert.throws(() => parsePackage('a: [', 'x.yaml'));
});

test('protocolli: Daikin, webhook, OAuth, Digest', () => {
  const d = parseDaikin('ret=OK,pow=1,mode=4,stemp=21.0,shum=0,f_rate=A,dt4=21.0');
  assert.equal(d.pow, '1');
  assert.equal(d.stemp, '21.0');
  const s = parseSensors('Finestra soggiorno | window | Soggiorno\n# commento\nH&T | temperature');
  assert.equal(s.length, 2);
  assert.equal(s[0].key, 'finestra_soggiorno');
  assert.equal(s[1].type, 'temperature');
  assert.deepEqual(parseAuthInput('https://x/cb?code=abc&state=s1'), { code: 'abc', state: 's1' });
  assert.deepEqual(parseAuthInput('abc'), { code: 'abc', state: null });
  const h = digestAuthorization({ method: 'GET', url: 'http://1.2.3.4/rpc/Shelly.GetStatus', username: 'admin', password: 'pw', challenge: 'Digest qop="auth", realm="shellypro1-abc", nonce="60dc59c6", algorithm=SHA-256' });
  assert.match(h, /^Digest username="admin", realm="shellypro1-abc".*response="[0-9a-f]{64}".*qop=auth/);
});
