/*
 * Client minimale per le API EZVIZ Open Platform (/api/lapp/...).
 * Scritto in ES5 + XMLHttpRequest per funzionare anche sulle TV webOS meno recenti.
 */
(function (global) {
  'use strict';

  var BASE_URLS = {
    eu: 'https://open.ezvizlife.com',
    cn: 'https://open.ys7.com'
  };
  var TOKEN_STORE_KEY = 'ezviztv.token';
  var TOKEN_EXPIRED = '10002';
  var LIVE_URL_TTL = 86400; // secondi di validità richiesti per gli indirizzi live

  function EzvizError(code, msg) {
    this.code = String(code);
    this.message = msg || ('Errore EZVIZ ' + code);
  }
  EzvizError.prototype = Object.create(Error.prototype);

  var FRIENDLY = {
    '10001': 'Parametri non validi',
    '10002': 'Accesso scaduto: riprovo',
    '10005': 'AppKey non valida o bloccata',
    '10017': 'AppKey non trovata: controlla la regione',
    '10030': 'AppKey e AppSecret non corrispondono',
    '20007': 'Telecamera offline',
    '20008': 'La telecamera non risponde',
    '20018': 'Questo account non possiede la telecamera',
    '49999': 'Errore del server EZVIZ',
    '60019': 'Video crittografato: inserisci il codice di verifica',
    '60060': 'Indirizzo live non disponibile per questa telecamera'
  };

  function friendlyMessage(code, msg) {
    return FRIENDLY[String(code)] || msg || ('Errore ' + code);
  }

  function encodeForm(params) {
    var parts = [];
    for (var k in params) {
      if (params.hasOwnProperty(k) && params[k] !== undefined && params[k] !== null && params[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
    }
    return parts.join('&');
  }

  function post(url, params) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.timeout = 20000;
      xhr.onload = function () {
        var body;
        try {
          body = JSON.parse(xhr.responseText);
        } catch (e) {
          reject(new EzvizError('http' + xhr.status, 'Risposta non valida dal server (' + xhr.status + ')'));
          return;
        }
        var code = String(body.code);
        if (code === '200') {
          resolve(body);
        } else {
          reject(new EzvizError(code, friendlyMessage(code, body.msg)));
        }
      };
      xhr.onerror = function () {
        reject(new EzvizError('network', 'Rete non raggiungibile'));
      };
      xhr.ontimeout = function () {
        reject(new EzvizError('timeout', 'Il server EZVIZ non risponde'));
      };
      xhr.send(encodeForm(params));
    });
  }

  function readStore(key) {
    try {
      return JSON.parse(global.localStorage.getItem(key) || 'null');
    } catch (e) {
      return null;
    }
  }

  function writeStore(key, value) {
    try {
      if (value === null) {
        global.localStorage.removeItem(key);
      } else {
        global.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) { /* storage non disponibile: si continua senza cache */ }
  }

  function Client(options) {
    this.region = options.region === 'cn' ? 'cn' : 'eu';
    this.appKey = options.appKey || '';
    this.appSecret = options.appSecret || '';
    this.staticToken = options.accessToken || '';
    this.baseUrl = BASE_URLS[this.region];
    this.token = null;
    this.liveCache = {};

    var saved = readStore(TOKEN_STORE_KEY);
    if (saved && saved.appKey === this.appKey && saved.region === this.region && saved.expireTime > Date.now() + 3600000) {
      this.token = saved;
    }
  }

  Client.prototype.isConfigured = function () {
    return !!(this.staticToken || (this.appKey && this.appSecret));
  };

  Client.prototype.getToken = function (force) {
    var self = this;
    if (self.staticToken && !(self.appKey && self.appSecret)) {
      return Promise.resolve({ accessToken: self.staticToken, areaDomain: self.baseUrl });
    }
    if (!force && self.token) {
      return Promise.resolve(self.token);
    }
    if (!self.appKey || !self.appSecret) {
      return Promise.reject(new EzvizError('config', 'Inserisci AppKey e AppSecret nelle Impostazioni'));
    }
    return post(self.baseUrl + '/api/lapp/token/get', {
      appKey: self.appKey,
      appSecret: self.appSecret
    }).then(function (body) {
      var data = body.data || {};
      self.token = {
        accessToken: data.accessToken,
        areaDomain: data.areaDomain || self.baseUrl,
        expireTime: data.expireTime || (Date.now() + 6 * 86400000),
        appKey: self.appKey,
        region: self.region
      };
      writeStore(TOKEN_STORE_KEY, self.token);
      return self.token;
    });
  };

  // Chiama un'API autenticata, rinnovando il token una volta se è scaduto.
  Client.prototype.call = function (path, params) {
    var self = this;
    function attempt(force) {
      return self.getToken(force).then(function (token) {
        var p = { accessToken: token.accessToken };
        for (var k in params) {
          if (params.hasOwnProperty(k)) p[k] = params[k];
        }
        return post(token.areaDomain + path, p);
      });
    }
    return attempt(false).catch(function (err) {
      if (err.code === TOKEN_EXPIRED && self.appKey && self.appSecret) {
        writeStore(TOKEN_STORE_KEY, null);
        self.token = null;
        return attempt(true);
      }
      throw err;
    });
  };

  // Restituisce tutte le telecamere (canali) dell'account.
  Client.prototype.listCameras = function () {
    var self = this;
    var pageSize = 50;
    var all = [];
    function page(n) {
      return self.call('/api/lapp/camera/list', { pageStart: n, pageSize: pageSize }).then(function (body) {
        var items = body.data || [];
        all = all.concat(items);
        var total = body.page && body.page.total;
        if (items.length === pageSize && (!total || all.length < total)) {
          return page(n + 1);
        }
        return all;
      });
    }
    return page(0).then(function (items) {
      return items.map(function (c) {
        return {
          id: c.deviceSerial + '-' + c.channelNo,
          source: 'ezviz',
          deviceSerial: c.deviceSerial,
          channelNo: c.channelNo || 1,
          name: c.channelName || c.deviceName || c.deviceSerial,
          online: String(c.status) === '1',
          encrypted: String(c.isEncrypt) === '1',
          snapshot: c.picUrl || ''
        };
      });
    });
  };

  // Ottiene l'indirizzo HLS del flusso live (con cache fino alla scadenza).
  Client.prototype.getLiveUrl = function (camera, quality, code, force) {
    var self = this;
    var key = camera.id + '|' + quality;
    var cached = self.liveCache[key];
    if (!force && cached && cached.expires > Date.now() + 60000) {
      return Promise.resolve(cached.url);
    }
    return self.call('/api/lapp/v2/live/address/get', {
      deviceSerial: camera.deviceSerial,
      channelNo: camera.channelNo,
      protocol: 2, // 2 = HLS
      quality: quality,
      type: 1, // 1 = live
      expireTime: LIVE_URL_TTL,
      code: code || ''
    }).then(function (body) {
      var data = body.data || {};
      if (!data.url) {
        throw new EzvizError('60060', friendlyMessage('60060'));
      }
      var url = data.url.replace(/^http:\/\//, 'https://');
      self.liveCache[key] = { url: url, expires: Date.now() + LIVE_URL_TTL * 1000 };
      return url;
    });
  };

  Client.prototype.forgetLiveUrl = function (camera) {
    for (var key in this.liveCache) {
      if (this.liveCache.hasOwnProperty(key) && key.indexOf(camera.id + '|') === 0) {
        delete this.liveCache[key];
      }
    }
  };

  // Scatta una foto istantanea dalla telecamera.
  Client.prototype.capture = function (camera) {
    return this.call('/api/lapp/device/capture', {
      deviceSerial: camera.deviceSerial,
      channelNo: camera.channelNo
    }).then(function (body) {
      return (body.data && body.data.picUrl) || '';
    });
  };

  // Brandeggio (PTZ). direction: 0 su, 1 giù, 2 sinistra, 3 destra, 8 zoom+, 9 zoom-
  Client.prototype.ptzStart = function (camera, direction) {
    return this.call('/api/lapp/device/ptz/start', {
      deviceSerial: camera.deviceSerial,
      channelNo: camera.channelNo,
      direction: direction,
      speed: 1
    });
  };

  Client.prototype.ptzStop = function (camera, direction) {
    return this.call('/api/lapp/device/ptz/stop', {
      deviceSerial: camera.deviceSerial,
      channelNo: camera.channelNo,
      direction: direction
    });
  };

  Client.clearTokenCache = function () {
    writeStore(TOKEN_STORE_KEY, null);
  };

  global.Ezviz = {
    Client: Client,
    Error: EzvizError
  };
})(window);
