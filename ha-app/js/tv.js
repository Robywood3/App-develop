/*
 * Funzioni della piattaforma webOS: servizi Luna, parametri di avvio,
 * salvaschermo. Fuori dalla TV (browser del PC) diventano innocue.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var bridges = []; // riferimenti alle chiamate attive, altrimenti il GC le interrompe

  function system() {
    return global.webOSSystem || global.PalmSystem || null;
  }

  function isTv() {
    return !!(system() && global.PalmServiceBridge);
  }

  function parseParams(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  // Chiama un servizio Luna (luna://...). Restituisce false se non disponibile.
  function lunaCall(uri, params, onResponse) {
    if (!global.PalmServiceBridge) return false;
    try {
      var bridge = new global.PalmServiceBridge();
      bridge.onservicecallback = function (msg) {
        if (onResponse) onResponse(parseParams(msg));
        if (!params.subscribe) {
          var i = bridges.indexOf(bridge);
          if (i >= 0) bridges.splice(i, 1);
        }
      };
      bridges.push(bridge);
      bridge.call(uri, JSON.stringify(params));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Chiede alla TV di non attivare il salvaschermo mentre l'app è aperta:
  // ogni richiesta di salvaschermo riceve risposta negativa.
  function blockScreenSaver(appId) {
    return lunaCall('luna://com.webos.service.tvpower/power/registerScreenSaverRequest', {
      subscribe: true,
      clientName: appId
    }, function (res) {
      if (res.timestamp === undefined) return;
      lunaCall('luna://com.webos.service.tvpower/power/responseScreenSaverRequest', {
        clientName: appId,
        ack: false,
        timestamp: res.timestamp
      });
    });
  }

  // Parametri con cui l'app è stata avviata (da Home Assistant o, sul PC,
  // dalla query string: index.html?path=/lovelace/camere&duration=30).
  function launchParams() {
    var sys = system();
    if (sys) return parseParams(sys.launchParams);
    var params = {};
    String(global.location.search || '').replace(/^\?/, '').split('&').forEach(function (pair) {
      var m = pair.match(/^([^=]+)=(.*)$/);
      if (m) params[decodeURIComponent(m[1])] = decodeURIComponent(m[2].replace(/\+/g, ' '));
    });
    return params;
  }

  // Avvisa quando l'app, già aperta, viene richiamata con nuovi parametri.
  function onRelaunch(handler) {
    doc.addEventListener('webOSRelaunch', function (e) {
      var sys = system();
      try {
        if (sys && sys.activate) sys.activate();
      } catch (err) { /* ignorato */ }
      handler(parseParams((e && e.detail) || (sys && sys.launchParams)));
    }, false);
  }

  function exit() {
    var sys = system();
    if (sys && sys.platformBack) sys.platformBack();
    else global.close();
  }

  global.Tv = {
    isTv: isTv,
    lunaCall: lunaCall,
    blockScreenSaver: blockScreenSaver,
    launchParams: launchParams,
    onRelaunch: onRelaunch,
    exit: exit
  };
})(window);
