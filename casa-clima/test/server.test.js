import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { start } from '../src/index.js';

let app;
let base;
let cookie = '';
const dir = mkdtempSync(path.join(tmpdir(), 'casa-clima-test-'));

async function call(method, url, body, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

before(async () => {
  app = await start({ port: 0, host: '127.0.0.1', dataDir: dir, quiet: true });
  base = `http://127.0.0.1:${app.port}`;
  await new Promise((r) => setTimeout(r, 300));
});

after(async () => {
  await app.stop();
  rmSync(dir, { recursive: true, force: true });
});

test('API protette finché non si imposta la password', async () => {
  assert.equal((await call('GET', '/api/states')).status, 401);
  assert.deepEqual((await call('GET', '/api/auth/status')).data, { configured: false, authenticated: false });
  assert.equal((await call('POST', '/api/auth/setup', { password: '123' })).status, 400);
  assert.equal((await call('POST', '/api/auth/setup', { password: 'segreta1' })).status, 200);
  assert.equal((await call('POST', '/api/auth/setup', { password: 'altra123' })).status, 403);
  const states = await call('GET', '/api/states');
  assert.equal(states.status, 200);
  assert.ok(states.data.some((s) => s.entity_id === 'select.casa_clima_profilo'));
});

test('servizi e Casa-Clima via API', async () => {
  const r = await call('POST', '/api/services/casa_clima/set_profile', { profile: 'notte' });
  assert.equal(r.status, 200);
  const cc = await call('GET', '/api/casa-clima');
  assert.equal(cc.data.profile, 'notte');
  assert.ok(cc.data.rooms.length >= 4);
  assert.equal((await call('POST', '/api/services/casa_clima/set_profile', { profile: 'boh' })).status, 400);
});

test('le integrazioni non espongono i segreti', async () => {
  const add = await call('POST', '/api/integrations', { type: 'webhook', options: { sensors: 'Finestra bagno | window | Bagno' } });
  assert.equal(add.status, 200);
  const tesla = await call('POST', '/api/integrations', { type: 'tesla', options: { provider: 'teslemetry', token: 'segretissimo' } });
  assert.equal(tesla.data.options.token, '••••••••');
  const list = await call('GET', '/api/integrations');
  assert.ok(!JSON.stringify(list.data).includes('segretissimo'));
  // modifica senza ritoccare il segreto: resta quello vecchio
  await call('PUT', `/api/integrations/${tesla.data.id}`, { options: { provider: 'teslemetry', token: '••••••••' } });
  const entry = app.config.data.integrations.find((e) => e.id === tesla.data.id);
  assert.equal(entry.options.token, 'segretissimo');
  await call('DELETE', `/api/integrations/${tesla.data.id}`);

  // webhook: aggiorna il sensore senza sessione, solo con il segreto
  await new Promise((r) => setTimeout(r, 200));
  const hooks = await call('GET', `/api/integrations/${add.data.id}/webhooks`);
  const url = new URL(hooks.data[0].url);
  const saved = cookie;
  cookie = '';
  const ok = await call('GET', `${url.pathname}?state=open`);
  assert.equal(ok.status, 200);
  assert.equal((await call('GET', '/api/webhook/sbagliato/finestra_bagno?state=open')).status, 404);
  cookie = saved;
  const st = await call('GET', '/api/states/binary_sensor.finestra_bagno');
  assert.equal(st.data.state, 'on');
});

test('pacchetti: validazione YAML', async () => {
  const bad = await call('PUT', '/api/packages/prova.yaml', { content: 'automations: [' });
  assert.equal(bad.status, 400);
  const good = await call('PUT', '/api/packages/prova.yaml', { content: 'automations:\n  - id: t\n    trigger: { trigger: time, at: "03:00" }\n    action: { action: notify.notify, data: { message: ciao } }\n' });
  assert.equal(good.status, 200);
  assert.ok((await call('GET', '/api/automations')).data.automations.some((a) => a.id === 't'));
  assert.equal((await call('GET', '/api/packages/..%2F..%2Fauth.json')).status, 404); // basename: niente uscita dalla cartella
});

test('logout', async () => {
  await call('POST', '/api/auth/logout');
  cookie = '';
  assert.equal((await call('GET', '/api/states')).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { password: 'no' })).status, 401);
});
