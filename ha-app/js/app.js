/*
 * HA Monitor — mostra le dashboard di Home Assistant sulla TV LG webOS,
 * comandata con il telecomando o da Home Assistant stesso.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var Tv = global.Tv;
  var APP_ID = 'com.robywood.hamonitor';
  var SETTINGS_KEY = 'hamonitor.settings';
  var DEFAULT_DASHBOARD = '/lovelace/0';
  var OVERLAY_TIMEOUT = 5000;
  var PROBE_TIMEOUT = 10000;
  var RETRY_INTERVAL = 10000;
  var HEALTH_INTERVAL = 30000;
  var OFFLINE_AFTER = 3; // controlli falliti di fila prima di mostrare "connessione persa"
  var FOCUS_RECLAIM = 45000;
  var DIRECT_COUNTDOWN = 3;
  var UNDIM_TIME = 60000;
  var SHIFT_INTERVAL = 180000;
  var SHIFT_STEPS = [[0, 0], [3, 0], [3, 3], [0, 3], [-3, 3], [-3, 0], [-3, -3], [0, -3], [3, -3]];

  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACK: 461, ESC: 27, BACKSPACE: 8,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,
    CH_UP: 33, CH_DOWN: 34
  };
  // Scorciatoie da tastiera per provare l'app su PC: R G Y B = tasti colorati.
  var PC_COLOR_KEYS = { 82: KEY.RED, 71: KEY.GREEN, 89: KEY.YELLOW, 66: KEY.BLUE };

  function $(id) { return doc.getElementById(id); }

  function show(el, visible) {
    if (visible) el.classList.remove('hidden');
    else el.classList.add('hidden');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  // ---------------------------------------------------------------- impostazioni

  function loadSavedSettings() {
    try {
      return JSON.parse(global.localStorage.getItem(SETTINGS_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function saveSettings(values) {
    try {
      global.localStorage.setItem(SETTINGS_KEY, JSON.stringify(values));
    } catch (e) { /* ignorato */ }
  }

  // "192.168.1.10" diventa "http://192.168.1.10:8123".
  function normalizeUrl(s) {
    s = String(s || '').trim().replace(/\/+$/, '');
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) {
      s = 'http://' + s;
      if (!/:\d+$/.test(s)) s += ':8123';
    }
    return s;
  }

  // Accetta "/lovelace/0", "lovelace/0" o un indirizzo completo (tiene solo il percorso).
  function normalizePath(p) {
    p = String(p || '').trim().replace(/^https?:\/\/[^\/]+/i, '');
    return p.charAt(0) === '/' ? p : '/' + p;
  }

  function normalizePaths(value) {
    var list = Array.isArray(value) ? value : String(value || '').split(',');
    list = list.filter(function (p) { return String(p || '').trim(); }).map(normalizePath);
    return list.length ? list : [DEFAULT_DASHBOARD];
  }

  function effectiveConfig() {
    var base = global.HA_MONITOR_CONFIG || {};
    var saved = loadSavedSettings();
    var cfg = {};
    var k;
    for (k in base) if (base.hasOwnProperty(k)) cfg[k] = base[k];
    for (k in saved) if (saved.hasOwnProperty(k)) cfg[k] = saved[k];
    cfg.url = normalizeUrl(cfg.url);
    cfg.dashboards = normalizePaths(cfg.dashboards);
    cfg.mode = cfg.mode === 'direct' ? 'direct' : 'frame';
    cfg.kiosk = cfg.kiosk === true || cfg.kiosk === 'true';
    cfg.zoom = [1, 1.25, 1.5].indexOf(Number(cfg.zoom)) >= 0 ? Number(cfg.zoom) : 1;
    cfg.rotateInterval = Number(cfg.rotateInterval) || 0;
    cfg.reloadHours = Number(cfg.reloadHours) || 0;
    cfg.nightDim = /^\d{1,2}-\d{1,2}$/.test(cfg.nightDim) ? cfg.nightDim : 'off';
    cfg.oledShift = cfg.oledShift === true || cfg.oledShift === 'true';
    return cfg;
  }

  // ---------------------------------------------------------------- stato

  var state = {
    screen: 'message',
    cfg: null,
    connectToken: 0,
    pending: null,
    index: 0,
    path: null,
    temp: false,
    tempTimer: null,
    rotating: false,
    rotateTimer: null,
    reloadTimer: null,
    healthTimer: null,
    retryTimer: null,
    reclaimTimer: null,
    overlayTimer: null,
    failures: 0,
    messageAction: null,
    shiftStep: 0,
    undimUntil: 0,
    settingsFocus: 0,
    settingsDraft: null,
    backPressedAt: 0
  };

  // ---------------------------------------------------------------- UI comuni

  var toastTimer = null;
  function toast(msg, ms) {
    var el = $('toast');
    el.innerHTML = escapeHtml(msg);
    show(el, true);
    if (toastTimer) global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () { show(el, false); }, ms || 3000);
  }

  function hint(key, cls, text) {
    return '<span class="hint"><span class="key ' + cls + '">' + key + '</span>' + escapeHtml(text) + '</span>';
  }

  function renderHints() {
    var h = '';
    var el = $('hints');
    if (state.screen === 'dash') {
      if (state.cfg.dashboards.length > 1) {
        h += hint('◀ ▶', '', 'Dashboard') + hint('', 'green', state.rotating ? 'Ferma rotazione' : 'Rotazione');
      }
      h += hint('', 'yellow', 'Comanda la pagina') + hint('', 'blue', 'Ricarica') + hint('', 'red', 'Impostazioni') + hint('↩', '', 'Esci');
    } else if (state.screen === 'message') {
      h = hint('OK', '', state.messageAction ? 'Apri' : 'Riprova') + hint('', 'blue', 'Riprova') + hint('', 'red', 'Impostazioni') + hint('↩', '', 'Esci');
    } else if (state.screen === 'settings') {
      h = hint('▲▼', '', 'Sposta') + hint('◀ ▶', '', 'Cambia opzione') + hint('OK', '', 'Modifica / conferma') + hint('↩', '', 'Annulla');
    }
    el.innerHTML = h;
    if (state.screen === 'dash') {
      el.classList.add('over-dash');
    } else {
      el.classList.remove('over-dash', 'faded');
    }
  }

  function renderBar() {
    var n = state.cfg.dashboards.length;
    var title = state.temp ? 'Vista richiesta' : (state.index + 1) + ' / ' + n;
    $('bar-title').innerHTML = escapeHtml(title + ' · ' + (state.path || ''));
    var badges = '';
    if (state.temp) badges += '<span class="badge temp">DA HOME ASSISTANT</span>';
    if (state.rotating) badges += '<span class="badge rotate">ROTAZIONE</span>';
    if (isNight()) badges += '<span class="badge night">NOTTE</span>';
    $('bar-badges').innerHTML = badges;
  }

  function showOverlay() {
    if (state.screen !== 'dash') return;
    $('bar').classList.remove('faded');
    $('hints').classList.remove('faded');
    if (state.overlayTimer) global.clearTimeout(state.overlayTimer);
    state.overlayTimer = global.setTimeout(hideOverlay, OVERLAY_TIMEOUT);
  }

  function hideOverlay() {
    if (state.overlayTimer) global.clearTimeout(state.overlayTimer);
    $('bar').classList.add('faded');
    $('hints').classList.add('faded');
  }

  function toggleOverlay() {
    if ($('bar').classList.contains('faded')) showOverlay();
    else hideOverlay();
  }

  function updateClock() {
    var d = new Date();
    $('clock').innerHTML = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    updateDim();
  }

  function switchScreen(name) {
    state.screen = name;
    show($('message-screen'), name === 'message');
    show($('settings-screen'), name === 'settings');
    if (name !== 'dash') {
      show($('dash-spinner'), false);
      hideOverlay();
    }
    renderHints();
  }

  // Schermata con un messaggio; okAction è l'azione del tasto OK (facoltativa).
  function showMessage(html, spinner, okAction) {
    state.messageAction = okAction || null;
    $('message').innerHTML = html;
    show($('message-spinner'), !!spinner);
    switchScreen('message');
  }

  // ---------------------------------------------------------------- aspetto

  function applyZoom() {
    var z = state.cfg.zoom;
    var frame = $('dash');
    frame.style.width = (100 / z) + '%';
    frame.style.height = (100 / z) + '%';
    var t = z === 1 ? '' : 'scale(' + z + ')';
    frame.style.webkitTransform = t;
    frame.style.transform = t;
  }

  function isNight() {
    var m = state.cfg && String(state.cfg.nightDim).match(/^(\d+)-(\d+)$/);
    if (!m) return false;
    var from = Number(m[1]);
    var to = Number(m[2]);
    var h = new Date().getHours();
    return from <= to ? (h >= from && h < to) : (h >= from || h < to);
  }

  function updateDim() {
    show($('dim'), isNight() && Date.now() > state.undimUntil);
  }

  // Protezione OLED: sposta la pagina di qualche pixel a ogni intervallo.
  function shiftStage() {
    var stage = $('stage');
    var step = [0, 0];
    if (state.cfg && state.cfg.oledShift) {
      state.shiftStep = (state.shiftStep + 1) % SHIFT_STEPS.length;
      step = SHIFT_STEPS[state.shiftStep];
    }
    var t = 'translate(' + step[0] + 'px, ' + step[1] + 'px)';
    stage.style.webkitTransform = t;
    stage.style.transform = t;
  }

  // ---------------------------------------------------------------- connessione

  // Verifica che Home Assistant risponda caricando la sua icona
  // (un'immagine non è soggetta alle restrizioni CORS).
  function probe(callback) {
    var done = false;
    var img = new global.Image();
    var timer = global.setTimeout(function () { finish(false); }, PROBE_TIMEOUT);
    function finish(ok) {
      if (done) return;
      done = true;
      global.clearTimeout(timer);
      img.onload = img.onerror = null;
      callback(ok);
    }
    img.onload = function () { finish(true); };
    img.onerror = function () { finish(false); };
    img.src = state.cfg.url + '/static/icons/favicon.ico?_=' + Date.now();
  }

  function clearTimers() {
    ['tempTimer', 'rotateTimer', 'reloadTimer', 'healthTimer', 'retryTimer'].forEach(function (name) {
      if (state[name]) {
        global.clearTimeout(state[name]);
        global.clearInterval(state[name]);
        state[name] = null;
      }
    });
  }

  // (Ri)avvia la connessione a Home Assistant con la configurazione attuale.
  function start(params) {
    clearTimers();
    state.connectToken++;
    state.cfg = effectiveConfig();
    state.failures = 0;
    state.temp = false;
    state.rotating = state.cfg.rotateInterval > 0;
    if (state.index >= state.cfg.dashboards.length) state.index = 0;
    if (params && (params.path || params.dashboard)) state.pending = params;
    applyZoom();
    shiftStage();
    updateDim();
    if (!state.cfg.url) {
      openSettings('Benvenuto! Inserisci l\'indirizzo di Home Assistant (ad esempio http://192.168.1.10:8123) ' +
        'e le dashboard da mostrare. Puoi anche scriverli nel file js/config.js prima di installare l\'app.');
      return;
    }
    showMessage('Connessione a Home Assistant…<small>' + escapeHtml(state.cfg.url) + '</small>', true);
    attemptConnect(state.connectToken);
  }

  function attemptConnect(token) {
    probe(function (ok) {
      if (token !== state.connectToken || state.screen === 'settings') return;
      if (ok) {
        onReachable();
        return;
      }
      showMessage('Home Assistant non raggiungibile<small>' + escapeHtml(state.cfg.url) +
        '<br>Nuovo tentativo tra ' + (RETRY_INTERVAL / 1000) + ' secondi · OK: apri comunque</small>', true, onReachable);
      state.retryTimer = global.setTimeout(function () { attemptConnect(token); }, RETRY_INTERVAL);
    });
  }

  function onReachable() {
    if (state.retryTimer) global.clearTimeout(state.retryTimer);
    state.retryTimer = null;
    if (state.cfg.mode === 'direct') startDirect();
    else openDashboards();
  }

  // Modalità diretta: dopo un breve conto alla rovescia (per poter aprire le
  // Impostazioni) la pagina dell'app viene sostituita da Home Assistant.
  function startDirect() {
    var p = state.pending;
    state.pending = null;
    var path = p && p.path ? normalizePath(p.path) : state.cfg.dashboards[0];
    var n = p && Number(p.dashboard);
    if (!(p && p.path) && n >= 1 && n <= state.cfg.dashboards.length) path = state.cfg.dashboards[n - 1];
    var url = dashboardUrl(path);
    var left = DIRECT_COUNTDOWN;
    function go() {
      global.location.replace(url);
    }
    function tick() {
      if (left <= 0) {
        go();
        return;
      }
      showMessage('Apro Home Assistant tra ' + left + ' s…<small>' + escapeHtml(url) +
        '<br>OK: apri subito · ROSSO: impostazioni (dopo l\'apertura esci con il tasto Home)</small>', false, go);
      left--;
      state.retryTimer = global.setTimeout(tick, 1000);
    }
    tick();
  }

  // ---------------------------------------------------------------- dashboard

  function dashboardUrl(path) {
    var url = state.cfg.url + path;
    if (state.cfg.kiosk && !/[?&]kiosk(=|&|$)/.test(path)) {
      url += (path.indexOf('?') >= 0 ? '&' : '?') + 'kiosk';
    }
    return url;
  }

  function openDashboards() {
    switchScreen('dash');
    var p = state.pending;
    state.pending = null;
    if (p) applyParams(p);
    else loadDashboard(state.index);
    startHealth();
    scheduleRotation();
    scheduleReload();
  }

  function loadUrl(path, quiet) {
    state.path = path;
    show($('dash-spinner'), true);
    $('dash').src = dashboardUrl(path);
    renderBar();
    if (!quiet) showOverlay();
  }

  function clearTemp() {
    if (state.tempTimer) global.clearTimeout(state.tempTimer);
    state.tempTimer = null;
    state.temp = false;
  }

  function loadDashboard(i, quiet) {
    var n = state.cfg.dashboards.length;
    state.index = ((i % n) + n) % n;
    clearTemp();
    loadUrl(state.cfg.dashboards[state.index], quiet);
  }

  function goDashboard(i) {
    loadDashboard(i);
    if (state.rotating) scheduleRotation();
  }

  // Parametri inviati da Home Assistant (o dalla query string sul PC):
  //   { "path": "/dashboard-tv/camere", "duration": 60 }  vista temporanea
  //   { "dashboard": 2 }                                  seconda dashboard della lista
  function applyParams(p) {
    var n = Number(p.dashboard);
    var count = state.cfg.dashboards.length;
    var sec = Number(p.duration) || 0;
    if (!p.path && n >= 1 && n <= count && !sec) {
      goDashboard(n - 1);
      return;
    }
    var path = p.path ? normalizePath(p.path) : state.cfg.dashboards[Math.max(0, Math.min(count - 1, (n || 1) - 1))];
    clearTemp();
    state.temp = true;
    loadUrl(path);
    if (sec > 0) {
      state.tempTimer = global.setTimeout(function () {
        if (state.screen === 'dash') loadDashboard(state.index, true);
        else clearTemp();
      }, sec * 1000);
    }
  }

  function handleLaunch(params) {
    if (!params || (!params.path && !params.dashboard)) return;
    if (state.screen === 'settings') return;
    if (state.screen === 'dash') applyParams(params);
    else state.pending = params; // applicati appena Home Assistant risponde
  }

  function scheduleRotation() {
    if (state.rotateTimer) global.clearInterval(state.rotateTimer);
    state.rotateTimer = null;
    if (!state.rotating || state.cfg.dashboards.length < 2) return;
    state.rotateTimer = global.setInterval(function () {
      if (state.screen === 'dash' && !state.temp && !doc.hidden) loadDashboard(state.index + 1, true);
    }, (state.cfg.rotateInterval || 60) * 1000);
  }

  function toggleRotation() {
    if (state.cfg.dashboards.length < 2) {
      toast('Aggiungi almeno due dashboard nelle Impostazioni per la rotazione');
      return;
    }
    state.rotating = !state.rotating;
    scheduleRotation();
    renderBar();
    renderHints();
    showOverlay();
    toast(state.rotating ? 'Rotazione avviata: ogni ' + (state.cfg.rotateInterval || 60) + ' secondi' : 'Rotazione fermata');
  }

  function scheduleReload() {
    if (state.reloadTimer) global.clearInterval(state.reloadTimer);
    state.reloadTimer = null;
    if (!state.cfg.reloadHours) return;
    state.reloadTimer = global.setInterval(function () {
      if (state.screen === 'dash' && !doc.hidden) loadUrl(state.path, true);
    }, state.cfg.reloadHours * 3600000);
  }

  // Controlla periodicamente Home Assistant: se non risponde per un po' lo
  // segnala, e quando torna raggiungibile ricarica la dashboard.
  function startHealth() {
    if (state.healthTimer) global.clearInterval(state.healthTimer);
    state.failures = 0;
    state.healthTimer = global.setInterval(checkHealth, HEALTH_INTERVAL);
  }

  function checkHealth() {
    if (doc.hidden || state.screen === 'settings') return;
    var token = state.connectToken;
    probe(function (ok) {
      if (token !== state.connectToken || state.screen === 'settings') return;
      if (ok) {
        var wasOffline = state.failures >= OFFLINE_AFTER;
        state.failures = 0;
        if (wasOffline) reopenDashboard();
        return;
      }
      state.failures++;
      if (state.failures === OFFLINE_AFTER) {
        showMessage('Connessione con Home Assistant persa<small>' + escapeHtml(state.cfg.url) +
          '<br>Riprovo ogni ' + (HEALTH_INTERVAL / 1000) + ' secondi · OK: ricarica ora</small>', true, reopenDashboard);
      }
    });
  }

  function reopenDashboard() {
    state.failures = 0;
    switchScreen('dash');
    loadUrl(state.path || state.cfg.dashboards[state.index]);
  }

  // Il tasto GIALLO passa il telecomando alla pagina di Home Assistant
  // (frecce per scorrere, OK per cliccare). Dopo un po' il controllo torna all'app.
  function focusDashboard() {
    var frame = $('dash');
    frame.focus();
    try {
      frame.contentWindow.focus();
    } catch (e) { /* ignorato */ }
    hideOverlay();
    toast('Il telecomando ora comanda la dashboard. Torna all\'app tra ' + (FOCUS_RECLAIM / 1000) + ' secondi.', 4000);
  }

  // Quando la dashboard prende il focus (clic con il puntatore o tasto GIALLO)
  // i tasti non arrivano più all'app: dopo un po' lo riprendiamo.
  function onWindowBlur() {
    if (state.reclaimTimer) global.clearTimeout(state.reclaimTimer);
    state.reclaimTimer = global.setTimeout(function () {
      state.reclaimTimer = null;
      if (doc.activeElement !== $('dash')) return;
      $('dash').blur();
      global.focus();
    }, FOCUS_RECLAIM);
  }

  // ---------------------------------------------------------------- impostazioni

  function settingsItems() {
    return Array.prototype.slice.call($('settings-screen').querySelectorAll('[data-focus]'));
  }

  function openSettings(intro) {
    var cfg = effectiveConfig();
    state.settingsDraft = {
      mode: cfg.mode,
      kiosk: String(cfg.kiosk),
      zoom: String(cfg.zoom),
      rotateInterval: String(cfg.rotateInterval),
      reloadHours: String(cfg.reloadHours),
      nightDim: cfg.nightDim,
      oledShift: String(cfg.oledShift)
    };
    $('set-url').value = cfg.url || '';
    $('set-dashboards').value = cfg.dashboards.join(', ');
    $('settings-intro').innerHTML = escapeHtml(intro || 'Usa le frecce per spostarti e OK per scrivere. Con il Magic Remote puoi anche puntare e cliccare.');
    renderSettingsOptions();
    switchScreen('settings');
    setSettingsFocus(0);
  }

  function renderSettingsOptions() {
    settingsItems().forEach(function (item) {
      if (item.getAttribute('data-focus') !== 'option') return;
      var key = item.getAttribute('data-key');
      Array.prototype.forEach.call(item.querySelectorAll('.chip'), function (chip) {
        if (chip.getAttribute('data-value') === state.settingsDraft[key]) chip.classList.add('selected');
        else chip.classList.remove('selected');
      });
    });
  }

  function setSettingsFocus(i) {
    var items = settingsItems();
    i = Math.max(0, Math.min(items.length - 1, i));
    items.forEach(function (el) { el.classList.remove('focused'); });
    state.settingsFocus = i;
    var el = items[i];
    el.classList.add('focused');
    // Scorre il pannello per tenere visibile l'elemento selezionato.
    var panel = doc.querySelector('.settings-panel');
    var screenH = $('settings-screen').clientHeight;
    var top = el.offsetTop;
    var current = -parseFloat(panel.style.top || '0');
    if (top - current > screenH * 0.7) current = top - screenH * 0.5;
    if (top - current < 0) current = Math.max(0, top - screenH * 0.2);
    panel.style.top = (-current) + 'px';
  }

  function cycleOption(item, delta) {
    var key = item.getAttribute('data-key');
    var chips = Array.prototype.slice.call(item.querySelectorAll('.chip'));
    var values = chips.map(function (c) { return c.getAttribute('data-value'); });
    var idx = values.indexOf(state.settingsDraft[key]);
    idx = Math.max(0, Math.min(values.length - 1, (idx < 0 ? 0 : idx) + delta));
    state.settingsDraft[key] = values[idx];
    renderSettingsOptions();
  }

  function settingsAction(action) {
    if (action === 'save') {
      var url = normalizeUrl($('set-url').value);
      if (!url) {
        toast('Inserisci l\'indirizzo di Home Assistant');
        setSettingsFocus(0);
        return;
      }
      var values = loadSavedSettings();
      var d = state.settingsDraft;
      values.url = url;
      values.dashboards = normalizePaths($('set-dashboards').value);
      values.mode = d.mode;
      values.kiosk = d.kiosk === 'true';
      values.zoom = Number(d.zoom);
      values.rotateInterval = Number(d.rotateInterval);
      values.reloadHours = Number(d.reloadHours);
      values.nightDim = d.nightDim;
      values.oledShift = d.oledShift === 'true';
      saveSettings(values);
      start();
    } else if (action === 'cancel') {
      if (!state.cfg.url) {
        toast('Inserisci l\'indirizzo di Home Assistant per continuare');
        return;
      }
      if (state.path && state.cfg.mode === 'frame' && state.failures < OFFLINE_AFTER) {
        switchScreen('dash');
        showOverlay();
      } else {
        start();
      }
    } else if (action === 'reset') {
      try {
        global.localStorage.removeItem(SETTINGS_KEY);
      } catch (e) { /* ignorato */ }
      state.cfg = effectiveConfig();
      toast('Dati salvati cancellati');
      openSettings();
    }
  }

  function handleSettingsKey(e, code) {
    var items = settingsItems();
    var item = items[state.settingsFocus];
    var type = item.getAttribute('data-focus');
    var active = doc.activeElement;
    var editing = active && active.tagName === 'INPUT';

    if (editing) {
      if (code === KEY.ENTER || code === KEY.BACK || code === KEY.ESC || code === KEY.UP || code === KEY.DOWN) {
        e.preventDefault();
        active.blur();
        if (code === KEY.UP) setSettingsFocus(state.settingsFocus - 1);
        if (code === KEY.DOWN) setSettingsFocus(state.settingsFocus + 1);
      }
      return;
    }

    switch (code) {
      case KEY.UP:
        setSettingsFocus(state.settingsFocus - 1);
        break;
      case KEY.DOWN:
        setSettingsFocus(state.settingsFocus + 1);
        break;
      case KEY.LEFT:
      case KEY.RIGHT:
        if (type === 'option') cycleOption(item, code === KEY.LEFT ? -1 : 1);
        else if (type === 'button') setSettingsFocus(state.settingsFocus + (code === KEY.LEFT ? -1 : 1));
        break;
      case KEY.ENTER:
        if (type === 'input') item.querySelector('input').focus();
        else if (type === 'option') cycleOption(item, 1);
        else if (type === 'button') settingsAction(item.getAttribute('data-action'));
        break;
      case KEY.BACK:
      case KEY.ESC:
      case KEY.BACKSPACE:
        settingsAction('cancel');
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  function bindSettingsPointer() {
    settingsItems().forEach(function (item, i) {
      item.addEventListener('mouseover', function () {
        if (state.screen === 'settings' && doc.activeElement.tagName !== 'INPUT') setSettingsFocus(i);
      });
      if (item.getAttribute('data-focus') === 'button') {
        item.addEventListener('click', function () { settingsAction(item.getAttribute('data-action')); });
      }
      if (item.getAttribute('data-focus') === 'input') {
        item.querySelector('input').addEventListener('focus', function () { setSettingsFocus(i); });
      }
    });
    Array.prototype.forEach.call(doc.querySelectorAll('.chip'), function (chip) {
      chip.addEventListener('click', function () {
        var field = chip.parentNode.parentNode;
        state.settingsDraft[field.getAttribute('data-key')] = chip.getAttribute('data-value');
        renderSettingsOptions();
      });
    });
  }

  // ---------------------------------------------------------------- tasti

  function exitApp() {
    var now = Date.now();
    if (now - state.backPressedAt < 2500) {
      Tv.exit();
    } else {
      state.backPressedAt = now;
      toast('Premi di nuovo INDIETRO per uscire');
    }
  }

  function handleDashKey(code) {
    if (code >= 49 && code <= 57) { // tasti 1-9
      if (code - 49 < state.cfg.dashboards.length) goDashboard(code - 49);
      return true;
    }
    switch (code) {
      case KEY.LEFT:
      case KEY.CH_DOWN:
        goDashboard(state.index - (state.temp ? 0 : 1));
        break;
      case KEY.RIGHT:
      case KEY.CH_UP:
        goDashboard(state.index + (state.temp ? 0 : 1));
        break;
      case KEY.UP:
      case KEY.DOWN:
        showOverlay();
        break;
      case KEY.ENTER:
        toggleOverlay();
        break;
      case KEY.RED: openSettings(); break;
      case KEY.GREEN: toggleRotation(); break;
      case KEY.YELLOW: focusDashboard(); break;
      case KEY.BLUE:
        toast('Ricarico la dashboard…', 1500);
        loadUrl(state.path);
        break;
      case KEY.BACK:
      case KEY.ESC:
      case KEY.BACKSPACE:
        if (state.temp) goDashboard(state.index);
        else if (state.index > 0) goDashboard(0);
        else exitApp();
        break;
      default:
        return false;
    }
    return true;
  }

  function handleMessageKey(code) {
    switch (code) {
      case KEY.ENTER:
        if (state.messageAction) state.messageAction();
        else start();
        break;
      case KEY.BLUE: start(); break;
      case KEY.RED: openSettings(); break;
      case KEY.BACK:
      case KEY.ESC:
      case KEY.BACKSPACE:
        exitApp();
        break;
      default:
        return false;
    }
    return true;
  }

  function onKeyDown(e) {
    var code = e.keyCode;
    var inInput = doc.activeElement && doc.activeElement.tagName === 'INPUT';
    if (!inInput && PC_COLOR_KEYS[code] && !e.ctrlKey && !e.metaKey) code = PC_COLOR_KEYS[code];

    // Di notte il primo tasto riaccende lo schermo per un minuto.
    if (state.screen === 'dash' && !$('dim').classList.contains('hidden')) {
      state.undimUntil = Date.now() + UNDIM_TIME;
      updateDim();
      e.preventDefault();
      return;
    }
    if (state.screen === 'settings') {
      handleSettingsKey(e, code);
      return;
    }
    var handled = state.screen === 'dash' ? handleDashKey(code) : handleMessageKey(code);
    if (handled) e.preventDefault();
  }

  function onVisibilityChange() {
    if (!doc.hidden && state.screen === 'dash') checkHealth();
  }

  // ---------------------------------------------------------------- avvio

  function init() {
    state.cfg = effectiveConfig();
    $('dash').addEventListener('load', function () { show($('dash-spinner'), false); });
    doc.addEventListener('keydown', onKeyDown, false);
    doc.addEventListener('visibilitychange', onVisibilityChange, false);
    global.addEventListener('blur', onWindowBlur, false);
    bindSettingsPointer();
    Tv.onRelaunch(handleLaunch);
    Tv.blockScreenSaver(APP_ID);
    updateClock();
    global.setInterval(updateClock, 10000);
    global.setInterval(shiftStage, SHIFT_INTERVAL);
    start(Tv.launchParams());
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
