/*
 * Riproduttore HLS: usa il lettore nativo della TV (decodifica hardware) quando
 * disponibile, altrimenti hls.js (utile anche per provare l'app nel browser).
 */
(function (global) {
  'use strict';

  var STALL_TIMEOUT = 20000;

  function nativeHlsSupported(video) {
    var ua = global.navigator.userAgent || '';
    var isTv = /Web0S|webOS|NetCast|SmartTV/i.test(ua);
    var can = video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL');
    return isTv || can === 'probably' || can === 'maybe';
  }

  function Player(video, handlers) {
    this.video = video;
    this.handlers = handlers || {};
    this.hls = null;
    this.url = null;
    this.watchdog = null;
    this.lastTime = 0;
    this.lastProgressAt = 0;
    this.started = false;

    var self = this;
    video.muted = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.addEventListener('playing', function () {
      self.started = true;
      self.lastProgressAt = Date.now();
      self.emit('playing');
    });
    video.addEventListener('timeupdate', function () {
      if (video.currentTime !== self.lastTime) {
        self.lastTime = video.currentTime;
        self.lastProgressAt = Date.now();
      }
    });
    video.addEventListener('waiting', function () {
      self.emit('waiting');
    });
    video.addEventListener('error', function () {
      if (self.url && !self.hls) {
        self.fail('Impossibile riprodurre il video');
      }
    });
  }

  Player.prototype.emit = function (name, arg) {
    if (this.handlers[name]) this.handlers[name](arg);
  };

  Player.prototype.fail = function (msg) {
    var url = this.url;
    this.stop();
    if (url) this.emit('error', msg);
  };

  Player.prototype.play = function (url) {
    var self = this;
    var video = self.video;
    self.stop();
    self.url = url;
    self.started = false;
    self.lastTime = 0;
    self.lastProgressAt = Date.now();

    if (!nativeHlsSupported(video) && global.Hls && global.Hls.isSupported()) {
      var hls = new global.Hls({ lowLatencyMode: true, liveSyncDurationCount: 2, manifestLoadingMaxRetry: 4 });
      self.hls = hls;
      hls.on(global.Hls.Events.ERROR, function (evt, data) {
        if (!data.fatal) return;
        if (data.type === global.Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          self.fail('Flusso non disponibile');
        }
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      video.src = url;
      video.load();
    }

    var p = video.play();
    if (p && p.catch) p.catch(function () { /* autoplay gestito da 'playing' */ });

    self.watchdog = global.setInterval(function () {
      if (!video.paused && Date.now() - self.lastProgressAt > STALL_TIMEOUT) {
        self.fail(self.started ? 'Il video si è bloccato' : 'La telecamera non invia video');
      }
    }, 5000);
  };

  Player.prototype.stop = function () {
    if (this.watchdog) {
      global.clearInterval(this.watchdog);
      this.watchdog = null;
    }
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.url = null;
    this.started = false;
    var video = this.video;
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) { /* ignorato */ }
  };

  Player.prototype.isActive = function () {
    return !!this.url;
  };

  global.HlsPlayer = Player;
})(window);
