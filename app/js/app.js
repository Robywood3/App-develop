/*
 * EZVIZ TV — interfaccia per TV LG webOS, comandata con il telecomando.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var SETTINGS_KEY = 'ezviztv.settings';
  var MAX_RETRIES = 3;
  var OVERLAY_TIMEOUT = 5000;
  var GRID_GAP_REM = 1.5;

  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACK: 461, ESC: 27, BACKSPACE: 8,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,
    CH_UP: 33, CH_DOWN: 34,
    PLAY: 415, PAUSE: 19, PLAY_PAUSE: 10252, STOP: 413
  };
  // Scorciatoie da tastiera per provare l'app su PC: R G Y B = tasti colorati.
  var PC_COLOR_KEYS = { 82: KEY.RED, 71: KEY.GREEN, 89: KEY.YELLOW, 66: KEY.BLUE };
  var PTZ_DIRECTION = {};
  PTZ_DIRECTION[KEY.UP] = 0;
  PTZ_DIRECTION[KEY.DOWN] = 1;
  PTZ_DIRECTION[KEY.LEFT] = 2;
  PTZ_DIRECTION[KEY.RIGHT] = 3;

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

  function effectiveConfig() {
    var base = global.EZVIZ_TV_CONFIG || {};
    var saved = loadSavedSettings();
    var cfg = {};
    var k;
    for (k in base) if (base.hasOwnProperty(k)) cfg[k] = base[k];
    for (k in saved) if (saved.hasOwnProperty(k)) cfg[k] = saved[k];
    cfg.region = cfg.region === 'cn' ? 'cn' : 'eu';
    cfg.quality = Number(cfg.quality) === 2 ? 2 : 1;
    cfg.snapshotInterval = Number(cfg.snapshotInterval) || 0;
    cfg.tourInterval = Number(cfg.tourInterval) || 20;
    cfg.liveGrid = cfg.liveGrid === true || cfg.liveGrid === 'true';
    cfg.verificationCodes = cfg.verificationCodes || {};
    cfg.hiddenCameras = cfg.hiddenCameras || [];
    cfg.customCameras = cfg.customCameras || [];
    return cfg;
  }

  function codesToText(codes) {
    var parts = [];
    for (var k in codes) if (codes.hasOwnProperty(k)) parts.push(k + ':' + codes[k]);
    return parts.join(', ');
  }

  function textToCodes(text) {
    var codes = {};
    String(text || '').split(/[,;\s]+/).forEach(function (pair) {
      var m = pair.match(/^([^:]+):(.+)$/);
      if (m) codes[m[1].trim().toUpperCase()] = m[2].trim();
    });
    return codes;
  }

  // ---------------------------------------------------------------- stato

  var state = {
    screen: 'grid',
    cfg: null,
    client: null,
    cameras: [],
    focus: 0,
    cols: 1,
    liveIndex: 0,
    liveQuality: 1,
    playToken: 0,
    retries: 0,
    retryTimer: null,
    ptzMode: false,
    ptzActive: null,
    ptzRequest: null,
    tourTimer: null,
    overlayTimer: null,
    snapshotTimer: null,
    snapshotBusy: false,
    gridPlayers: [],
    settingsFocus: 0,
    settingsDraft: null,
    backPressedAt: 0,
    loading: false
  };

  var livePlayer;

  // ---------------------------------------------------------------- UI comuni

  var toastTimer = null;
  function toast(msg, ms) {
    var el = $('toast');
    el.innerHTML = escapeHtml(msg);
    show(el, true);
    if (toastTimer) global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () { show(el, false); }, ms || 3000);
  }

  function setStatus(msg) {
    $('status').innerHTML = escapeHtml(msg || '');
  }

  function hint(key, cls, text) {
    return '<span class="hint"><span class="key ' + cls + '">' + key + '</span>' + escapeHtml(text) + '</span>';
  }

  function renderHints() {
    var h = '';
    var el = $('hints');
    if (state.screen === 'grid') {
      h = hint('OK', '', 'Schermo intero') +
        hint('1-9', '', 'Vai alla telecamera') +
        hint('', 'red', 'Impostazioni') +
        hint('', 'green', 'Sequenza') +
        hint('', 'blue', 'Aggiorna');
    } else if (state.screen === 'live') {
      var cam = state.cameras[state.liveIndex];
      if (state.ptzMode) {
        h = hint('◀▲▼▶', '', 'Muovi la telecamera') + hint('', 'yellow', 'Fine brandeggio') + hint('CH', '', 'Cambia telecamera');
      } else {
        h = hint('◀ ▶', '', 'Telecamera precedente/successiva') + hint('OK', '', 'Info');
        if (cam && cam.source === 'ezviz') {
          h += hint('', 'yellow', 'Brandeggio') + hint('', 'blue', state.liveQuality === 1 ? 'Passa a Fluido' : 'Passa a HD');
        }
        h += hint('', 'green', state.tourTimer ? 'Ferma sequenza' : 'Sequenza');
      }
      h += hint('↩', '', 'Indietro');
    } else if (state.screen === 'settings') {
      h = hint('▲▼', '', 'Sposta') + hint('◀ ▶', '', 'Cambia opzione') + hint('OK', '', 'Modifica / conferma') + hint('↩', '', 'Annulla');
    }
    el.innerHTML = h;
    if (state.screen === 'live') el.classList.add('over-video');
    else el.classList.remove('over-video', 'faded');
  }

  function updateClock() {
    var d = new Date();
    $('clock').innerHTML = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function switchScreen(name) {
    state.screen = name;
    show($('grid-screen'), name === 'grid' || name === 'settings');
    show($('live-screen'), name === 'live');
    show($('settings-screen'), name === 'settings');
    show($('topbar'), name !== 'live');
    renderHints();
  }

  // ---------------------------------------------------------------- caricamento

  function connect() {
    state.cfg = effectiveConfig();
    state.liveQuality = state.cfg.quality;
    state.client = new global.Ezviz.Client(state.cfg);
    return loadCameras();
  }

  function customCameras() {
    return state.cfg.customCameras.filter(function (c) { return c && c.url; }).map(function (c, i) {
      return {
        id: 'custom-' + i,
        source: 'custom',
        name: c.name || ('Telecamera ' + (i + 1)),
        url: c.url,
        online: true,
        snapshot: c.snapshot || ''
      };
    });
  }

  function loadCameras() {
    var custom = customCameras();
    if (!state.client.isConfigured() && !custom.length) {
      openSettings('Benvenuto! Inserisci AppKey e AppSecret della tua applicazione EZVIZ Open Platform ' +
        '(vedi README). Puoi anche scriverli nel file js/config.js prima di installare l\'app.');
      return Promise.resolve();
    }
    state.loading = true;
    setStatus('Caricamento telecamere…');
    gridMessage(null);
    var ezviz = state.client.isConfigured() ? state.client.listCameras() : Promise.resolve([]);
    return ezviz.then(function (list) {
      var hidden = state.cfg.hiddenCameras.map(function (s) { return String(s).toUpperCase(); });
      list = list.filter(function (c) { return hidden.indexOf(String(c.deviceSerial).toUpperCase()) < 0; });
      state.cameras = list.concat(custom);
      state.loading = false;
      var online = state.cameras.filter(function (c) { return c.online; }).length;
      setStatus(state.cameras.length + ' telecamere · ' + online + ' online');
      if (state.focus >= state.cameras.length) state.focus = 0;
      renderGrid();
      if (!state.cameras.length) {
        gridMessage('Nessuna telecamera trovata su questo account.<small>Verifica di aver creato l\'applicazione con lo stesso account dell\'app EZVIZ.</small>');
      }
      scheduleSnapshots(true);
    }).catch(function (err) {
      state.loading = false;
      setStatus('');
      state.cameras = custom;
      renderGrid();
      gridMessage(escapeHtml(err.message) + '<small>Premi il tasto BLU per riprovare o il ROSSO per le Impostazioni.</small>');
    });
  }

  function gridMessage(html) {
    var el = $('grid-message');
    el.innerHTML = html || '';
    show(el, !!html);
  }

  // ---------------------------------------------------------------- griglia

  function gridLayout(n) {
    var cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
    return { cols: cols, rows: Math.max(1, Math.ceil(n / cols)) };
  }

  function renderGrid() {
    stopGridPlayers();
    var grid = $('grid');
    var cams = state.cameras;
    grid.innerHTML = '';
    if (!cams.length) return;

    var layout = gridLayout(cams.length);
    state.cols = layout.cols;
    var rem = parseFloat(global.getComputedStyle(doc.documentElement).fontSize) || 16;
    var gap = GRID_GAP_REM * rem;
    var W = grid.clientWidth;
    var H = grid.clientHeight;
    // Mostra al massimo 3 righe alla volta: le altre si raggiungono scorrendo.
    var visibleRows = Math.min(layout.rows, 3);
    var tileW = (W - gap * (layout.cols - 1)) / layout.cols;
    var tileH = tileW * 9 / 16;
    var maxH = (H - gap * (visibleRows - 1)) / visibleRows;
    if (tileH > maxH) {
      tileH = maxH;
      tileW = tileH * 16 / 9;
    }
    var totalW = tileW * layout.cols + gap * (layout.cols - 1);
    var totalH = tileH * visibleRows + gap * (visibleRows - 1);
    var offsetX = (W - totalW) / 2;
    var offsetY = Math.max(0, (H - totalH) / 2);

    cams.forEach(function (cam, i) {
      var col = i % layout.cols;
      var row = Math.floor(i / layout.cols);
      var tile = doc.createElement('div');
      tile.className = 'tile' + (cam.online ? '' : ' offline');
      tile.style.left = (offsetX + col * (tileW + gap)) + 'px';
      tile.style.top = (offsetY + row * (tileH + gap)) + 'px';
      tile.style.width = tileW + 'px';
      tile.style.height = tileH + 'px';
      tile.setAttribute('data-row', row);
      tile.innerHTML =
        '<div class="placeholder">' + (cam.source === 'custom' ? 'HLS' : '◉') + '</div>' +
        (cam.snapshot ? '<img src="' + escapeHtml(cam.snapshot) + '" alt="">' : '') +
        (i < 9 ? '<div class="number">' + (i + 1) + '</div>' : '') +
        (cam.online ? '' : '<div class="tag">offline</div>') +
        '<div class="label"><span class="dot' + (cam.online ? '' : ' offline') + '"></span>' + escapeHtml(cam.name) + '</div>';
      tile.addEventListener('mouseover', function () { setGridFocus(i); });
      tile.addEventListener('click', function () { setGridFocus(i); openLive(i); });
      grid.appendChild(tile);
    });
    state.rowHeight = tileH + gap;
    setGridFocus(state.focus);
    startGridPlayers();
  }

  function setGridFocus(i) {
    var tiles = $('grid').children;
    if (!tiles.length) return;
    i = Math.max(0, Math.min(tiles.length - 1, i));
    if (tiles[state.focus]) tiles[state.focus].classList.remove('focused');
    state.focus = i;
    tiles[i].classList.add('focused');
    // Scorre la griglia per tenere visibile la riga selezionata.
    var row = Number(tiles[i].getAttribute('data-row'));
    var shift = Math.max(0, row - 2) * (state.rowHeight || 0);
    $('grid').style.marginTop = (-shift) + 'px';
  }

  function moveGridFocus(dx, dy) {
    var n = state.cameras.length;
    if (!n) return;
    var i = state.focus;
    if (dx) {
      i = (i + dx + n) % n;
    } else {
      var next = i + dy * state.cols;
      if (next >= 0 && next < n) i = next;
      else if (dy > 0 && Math.floor(i / state.cols) < Math.floor((n - 1) / state.cols)) i = n - 1;
    }
    setGridFocus(i);
  }

  function updateTileSnapshot(index, url) {
    var tile = $('grid').children[index];
    if (!tile || !url) return;
    var img = tile.querySelector('img');
    var loader = new global.Image();
    loader.onload = function () {
      if (!img) {
        img = doc.createElement('img');
        tile.insertBefore(img, tile.children[1] || null);
      }
      img.src = url;
    };
    loader.src = url;
  }

  // Aggiorna le anteprime una telecamera alla volta per non sovraccaricare le API.
  function refreshSnapshots() {
    if (state.snapshotBusy || state.screen !== 'grid' || state.cfg.liveGrid) return;
    var targets = [];
    state.cameras.forEach(function (cam, i) {
      if (cam.source === 'ezviz' && cam.online) targets.push(i);
    });
    if (!targets.length) return;
    state.snapshotBusy = true;
    function next() {
      if (!targets.length || state.screen !== 'grid') {
        state.snapshotBusy = false;
        return;
      }
      var i = targets.shift();
      var cam = state.cameras[i];
      state.client.capture(cam).then(function (url) {
        if (url && state.cameras[i] === cam) {
          cam.snapshot = url;
          updateTileSnapshot(i, url);
        }
      }).catch(function () { /* resta l'anteprima precedente */ }).then(function () {
        global.setTimeout(next, 500);
      });
    }
    next();
  }

  function scheduleSnapshots(immediate) {
    if (state.snapshotTimer) global.clearInterval(state.snapshotTimer);
    state.snapshotTimer = null;
    var sec = state.cfg && state.cfg.snapshotInterval;
    if (!sec) return;
    if (immediate) refreshSnapshots();
    state.snapshotTimer = global.setInterval(refreshSnapshots, sec * 1000);
  }

  function startGridPlayers() {
    if (!state.cfg.liveGrid || state.screen !== 'grid') return;
    var tiles = $('grid').children;
    state.cameras.forEach(function (cam, i) {
      if (!cam.online || i >= 9) return;
      var video = doc.createElement('video');
      tiles[i].insertBefore(video, tiles[i].querySelector('.number') || null);
      var player = new global.HlsPlayer(video, {
        error: function () {
          if (video.parentNode) video.parentNode.removeChild(video);
        }
      });
      state.gridPlayers.push(player);
      streamUrl(cam, 2).then(function (url) {
        if (state.gridPlayers.indexOf(player) >= 0) player.play(url);
      }).catch(function () {
        if (video.parentNode) video.parentNode.removeChild(video);
      });
    });
  }

  function stopGridPlayers() {
    state.gridPlayers.forEach(function (p) {
      p.stop();
      if (p.video.parentNode) p.video.parentNode.removeChild(p.video);
    });
    state.gridPlayers = [];
  }

  // ---------------------------------------------------------------- dal vivo

  function streamUrl(cam, quality, force) {
    if (cam.source === 'custom') return Promise.resolve(cam.url);
    var code = state.cfg.verificationCodes[String(cam.deviceSerial).toUpperCase()] ||
      state.cfg.verificationCodes[cam.deviceSerial] || '';
    return state.client.getLiveUrl(cam, quality, code, force);
  }

  function openLive(index) {
    if (!state.cameras.length) return;
    stopGridPlayers();
    if (state.snapshotTimer) global.clearInterval(state.snapshotTimer);
    state.snapshotTimer = null;
    switchScreen('live');
    playCamera(index);
  }

  function closeLive() {
    stopPtz();
    state.ptzMode = false;
    stopTour();
    clearRetry();
    state.playToken++;
    livePlayer.stop();
    switchScreen('grid');
    setGridFocus(state.liveIndex);
    startGridPlayers();
    scheduleSnapshots(false);
  }

  function clearRetry() {
    if (state.retryTimer) global.clearTimeout(state.retryTimer);
    state.retryTimer = null;
  }

  function liveMessage(html) {
    var el = $('live-message');
    el.innerHTML = html || '';
    show(el, !!html);
  }

  function renderLiveInfo() {
    var cam = state.cameras[state.liveIndex];
    if (!cam) return;
    $('live-name').innerHTML = escapeHtml(cam.name);
    $('live-index').innerHTML = (state.liveIndex + 1) + ' / ' + state.cameras.length;
    $('live-dot').className = 'dot' + (cam.online ? '' : ' offline');
    var badges = '<span class="badge live">LIVE</span>';
    if (cam.source === 'ezviz') badges += '<span class="badge">' + (state.liveQuality === 1 ? 'HD' : 'Fluido') + '</span>';
    if (state.tourTimer) badges += '<span class="badge tour">SEQUENZA</span>';
    if (state.ptzMode) badges += '<span class="badge ptz">BRANDEGGIO</span>';
    $('live-badges').innerHTML = badges;
    renderHints();
  }

  function showOverlay() {
    $('live-overlay').classList.remove('faded');
    $('hints').classList.remove('faded');
    if (state.overlayTimer) global.clearTimeout(state.overlayTimer);
    state.overlayTimer = global.setTimeout(function () {
      if (state.ptzMode) return;
      $('live-overlay').classList.add('faded');
      $('hints').classList.add('faded');
    }, OVERLAY_TIMEOUT);
  }

  function toggleOverlay() {
    if ($('live-overlay').classList.contains('faded')) {
      showOverlay();
    } else {
      if (state.overlayTimer) global.clearTimeout(state.overlayTimer);
      $('live-overlay').classList.add('faded');
      $('hints').classList.add('faded');
    }
  }

  function playCamera(index, isRetry) {
    var n = state.cameras.length;
    index = ((index % n) + n) % n;
    if (index !== state.liveIndex || !isRetry) {
      stopPtz();
      if (state.ptzMode && state.cameras[index].source !== 'ezviz') state.ptzMode = false;
    }
    if (!isRetry) state.retries = 0;
    state.liveIndex = index;
    state.focus = index;
    clearRetry();
    var token = ++state.playToken;
    var cam = state.cameras[index];
    livePlayer.stop();
    liveMessage(null);
    show($('live-spinner'), true);
    renderLiveInfo();
    showOverlay();

    streamUrl(cam, state.liveQuality, isRetry).then(function (url) {
      if (token !== state.playToken) return;
      livePlayer.play(url);
    }).catch(function (err) {
      if (token !== state.playToken) return;
      handleLiveError(err.message, err.code !== 'config' && err.code !== '60019' && err.code !== '10030');
    });
  }

  function handleLiveError(msg, retryable) {
    var cam = state.cameras[state.liveIndex];
    show($('live-spinner'), false);
    if (cam && !cam.online) msg = 'Telecamera offline';
    if (retryable && state.retries < MAX_RETRIES) {
      state.retries++;
      liveMessage(escapeHtml(msg) + '<small>Nuovo tentativo ' + state.retries + ' di ' + MAX_RETRIES + '…</small>');
      if (cam && cam.source === 'ezviz') state.client.forgetLiveUrl(cam);
      var token = state.playToken;
      state.retryTimer = global.setTimeout(function () {
        if (token === state.playToken && state.screen === 'live') playCamera(state.liveIndex, true);
      }, 3000);
    } else {
      liveMessage(escapeHtml(msg) + '<small>Premi OK per riprovare · ◀ ▶ per cambiare telecamera</small>');
    }
  }

  function onLivePlaying() {
    state.retries = 0;
    show($('live-spinner'), false);
    liveMessage(null);
  }

  // ---------------------------------------------------------------- sequenza

  function startTour() {
    if (state.cameras.length < 2) {
      toast('Servono almeno due telecamere per la sequenza');
      return;
    }
    if (state.screen !== 'live') openLive(state.focus);
    restartTourTimer();
    renderLiveInfo();
    toast('Sequenza avviata: ogni ' + state.cfg.tourInterval + ' secondi');
  }

  function restartTourTimer() {
    if (state.tourTimer) global.clearInterval(state.tourTimer);
    state.tourTimer = global.setInterval(function () {
      if (!state.ptzMode) playCamera(state.liveIndex + 1);
    }, state.cfg.tourInterval * 1000);
  }

  function stopTour() {
    if (state.tourTimer) global.clearInterval(state.tourTimer);
    state.tourTimer = null;
  }

  // ---------------------------------------------------------------- brandeggio

  function togglePtz() {
    var cam = state.cameras[state.liveIndex];
    if (!cam || cam.source !== 'ezviz') return;
    stopPtz();
    state.ptzMode = !state.ptzMode;
    renderLiveInfo();
    showOverlay();
    if (state.ptzMode) toast('Brandeggio attivo: tieni premute le frecce per muovere la telecamera');
  }

  function startPtz(keyCode) {
    var dir = PTZ_DIRECTION[keyCode];
    if (state.ptzActive === dir) return; // tasto tenuto premuto: ripetizione
    stopPtz();
    var cam = state.cameras[state.liveIndex];
    state.ptzActive = dir;
    state.ptzRequest = state.client.ptzStart(cam, dir).catch(function (err) {
      if (state.ptzActive === dir) state.ptzActive = null;
      toast('Brandeggio non disponibile: ' + err.message);
    });
  }

  function stopPtz() {
    if (state.ptzActive === null) return;
    var dir = state.ptzActive;
    var cam = state.cameras[state.liveIndex];
    state.ptzActive = null;
    if (!cam || cam.source !== 'ezviz') return;
    // Lo stop parte solo dopo la risposta allo start, così non arriva prima.
    (state.ptzRequest || Promise.resolve()).then(function () {
      return state.client.ptzStop(cam, dir);
    }).catch(function () {});
  }

  // ---------------------------------------------------------------- impostazioni

  function settingsItems() {
    return Array.prototype.slice.call($('settings-screen').querySelectorAll('[data-focus]'));
  }

  function openSettings(intro) {
    if (state.screen === 'live') closeLive();
    stopGridPlayers();
    var cfg = effectiveConfig();
    state.settingsDraft = {
      region: cfg.region,
      quality: String(cfg.quality),
      snapshotInterval: String(cfg.snapshotInterval),
      tourInterval: String(cfg.tourInterval),
      liveGrid: String(cfg.liveGrid)
    };
    $('set-appkey').value = cfg.appKey || '';
    $('set-appsecret').value = cfg.appSecret || '';
    $('set-token').value = cfg.accessToken || '';
    $('set-codes').value = codesToText(cfg.verificationCodes);
    $('settings-intro').innerHTML = escapeHtml(intro || 'Usa le frecce per spostarti e OK per scrivere. Con il Magic Remote puoi anche puntare e cliccare.');
    renderSettingsOptions();
    switchScreen('settings');
    setSettingsFocus(intro ? 1 : 0);
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
      var values = loadSavedSettings();
      var d = state.settingsDraft;
      values.region = d.region;
      values.quality = Number(d.quality);
      values.snapshotInterval = Number(d.snapshotInterval);
      values.tourInterval = Number(d.tourInterval);
      values.liveGrid = d.liveGrid === 'true';
      values.appKey = $('set-appkey').value.trim();
      values.appSecret = $('set-appsecret').value.trim();
      values.accessToken = $('set-token').value.trim();
      values.verificationCodes = textToCodes($('set-codes').value);
      saveSettings(values);
      global.Ezviz.Client.clearTokenCache();
      switchScreen('grid');
      connect();
    } else if (action === 'cancel') {
      if (!state.client || (!state.client.isConfigured() && !state.cameras.length)) {
        toast('Configura l\'account EZVIZ per vedere le telecamere');
        return;
      }
      switchScreen('grid');
      setGridFocus(state.focus);
      startGridPlayers();
    } else if (action === 'reset') {
      try {
        global.localStorage.removeItem(SETTINGS_KEY);
      } catch (e) { /* ignorato */ }
      global.Ezviz.Client.clearTokenCache();
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
      if (global.webOS && global.webOS.platformBack) global.webOS.platformBack();
      else global.close();
    } else {
      state.backPressedAt = now;
      toast('Premi di nuovo INDIETRO per uscire');
    }
  }

  function handleGridKey(code) {
    if (code >= 49 && code <= 57) { // tasti 1-9
      var idx = code - 49;
      if (idx < state.cameras.length) {
        setGridFocus(idx);
        openLive(idx);
      }
      return true;
    }
    switch (code) {
      case KEY.LEFT: moveGridFocus(-1, 0); break;
      case KEY.RIGHT: moveGridFocus(1, 0); break;
      case KEY.UP: moveGridFocus(0, -1); break;
      case KEY.DOWN: moveGridFocus(0, 1); break;
      case KEY.ENTER:
      case KEY.PLAY:
        if (state.cameras.length) openLive(state.focus);
        break;
      case KEY.RED: openSettings(); break;
      case KEY.GREEN: startTour(); break;
      case KEY.BLUE:
        toast('Aggiornamento…', 1500);
        connect();
        break;
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

  function handleLiveKey(code, repeat) {
    if (code >= 49 && code <= 57) {
      if (code - 49 < state.cameras.length) playCamera(code - 49);
      return true;
    }
    if (state.ptzMode && PTZ_DIRECTION.hasOwnProperty(code)) {
      startPtz(code);
      return true;
    }
    if (repeat && code !== KEY.UP && code !== KEY.DOWN) return true;
    switch (code) {
      case KEY.LEFT:
      case KEY.CH_DOWN:
        if (state.tourTimer) restartTourTimer();
        playCamera(state.liveIndex - 1);
        break;
      case KEY.RIGHT:
      case KEY.CH_UP:
        if (state.tourTimer) restartTourTimer();
        playCamera(state.liveIndex + 1);
        break;
      case KEY.UP:
      case KEY.DOWN:
        showOverlay();
        break;
      case KEY.ENTER:
        if (!$('live-message').classList.contains('hidden')) playCamera(state.liveIndex);
        else toggleOverlay();
        break;
      case KEY.PLAY:
      case KEY.PLAY_PAUSE:
        playCamera(state.liveIndex);
        break;
      case KEY.PAUSE:
      case KEY.STOP:
        clearRetry();
        state.playToken++;
        livePlayer.stop();
        liveMessage('In pausa<small>Premi OK o PLAY per riprendere</small>');
        break;
      case KEY.YELLOW: togglePtz(); break;
      case KEY.GREEN:
        if (state.tourTimer) {
          stopTour();
          renderLiveInfo();
          toast('Sequenza fermata');
        } else {
          startTour();
        }
        break;
      case KEY.BLUE:
        var cam = state.cameras[state.liveIndex];
        if (cam && cam.source === 'ezviz') {
          state.liveQuality = state.liveQuality === 1 ? 2 : 1;
          playCamera(state.liveIndex);
        }
        break;
      case KEY.RED: openSettings(); break;
      case KEY.BACK:
      case KEY.ESC:
      case KEY.BACKSPACE:
        if (state.ptzMode) togglePtz();
        else closeLive();
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

    if (state.screen === 'settings') {
      handleSettingsKey(e, code);
      return;
    }
    var handled = state.screen === 'live' ? handleLiveKey(code, e.repeat) : handleGridKey(code);
    if (handled) e.preventDefault();
  }

  function onKeyUp(e) {
    if (state.screen === 'live' && state.ptzMode && PTZ_DIRECTION.hasOwnProperty(e.keyCode)) {
      stopPtz();
    }
  }

  // Quando l'app va in secondo piano libera il decoder video; al ritorno riprende.
  function onVisibilityChange() {
    if (doc.hidden) {
      stopPtz();
      clearRetry();
      state.playToken++;
      livePlayer.stop();
      stopGridPlayers();
      if (state.snapshotTimer) global.clearInterval(state.snapshotTimer);
      state.snapshotTimer = null;
    } else if (state.screen === 'live') {
      playCamera(state.liveIndex);
    } else if (state.screen === 'grid') {
      startGridPlayers();
      scheduleSnapshots(true);
    }
  }

  // ---------------------------------------------------------------- avvio

  function init() {
    livePlayer = new global.HlsPlayer($('live-video'), {
      playing: onLivePlaying,
      waiting: function () { show($('live-spinner'), true); },
      error: function (msg) { handleLiveError(msg, true); }
    });
    $('live-video').addEventListener('playing', function () { show($('live-spinner'), false); });
    $('live-screen').addEventListener('click', function () {
      if (state.screen === 'live') toggleOverlay();
    });
    doc.addEventListener('keydown', onKeyDown, false);
    doc.addEventListener('keyup', onKeyUp, false);
    doc.addEventListener('visibilitychange', onVisibilityChange, false);
    global.addEventListener('resize', function () {
      if (state.screen === 'grid') renderGrid();
    });
    bindSettingsPointer();
    updateClock();
    global.setInterval(updateClock, 10000);
    switchScreen('grid');
    connect();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
