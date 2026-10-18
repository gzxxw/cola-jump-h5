/* UI：屏幕切换 + 存档（APK 素材） */
(function (global) {
  'use strict';
  var UI = {
    screens: {},
    save: { level: 1, coins: 0, gems: 0, sound: true, vibro: true },
    onPlay: null, onRetry: null, onNext: null, onBack: null,
    init: function (callbacks) {
      var self = UI;
      callbacks = callbacks || {};
      self.onPlay = callbacks.play; self.onRetry = callbacks.retry;
      self.onNext = callbacks.next; self.onBack = callbacks.back; self.onMenu = callbacks.menu;
      ['loading', 'menu', 'hud', 'fail', 'done', 'settings'].forEach(function (n) {
        self.screens[n] = document.getElementById('screen-' + n);
      });
      self.loadSave();
      function bind(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', function (e) { e.stopPropagation(); Sound.play('click'); fn && fn(); }); }
      bind('btn-play', function () { self.show('hud'); self.onPlay && self.onPlay(); });
      bind('btn-settings', function () { self.show('settings'); });
      bind('btn-settings-close', function () { self.show(UI.lastScreen || 'menu'); });
      bind('btn-sound', function () { self.toggleSound(); });
      bind('btn-sound2', function () { self.toggleSound(); });
      bind('btn-vibro', function () { self.toggleVibro(); });
      bind('btn-retry', function () { self.show('hud'); self.onRetry && self.onRetry(); });
      bind('btn-fail-menu', function () { self.show('menu'); self.onMenu && self.onMenu(); });
      bind('btn-next', function () { self.show('hud'); self.onNext && self.onNext(); });
      bind('btn-done-menu', function () { self.show('menu'); self.onMenu && self.onMenu(); });
      bind('btn-back', function () { self.show('menu'); self.onBack && self.onBack(); });
      self.syncSoundIcon();
    },
    loadSave: function () {
      try {
        var s = JSON.parse(localStorage.getItem('bottleJumpSave') || 'null');
        if (s) for (var k in s) UI.save[k] = s[k];
      } catch (e) {}
    },
    persist: function () {
      try { localStorage.setItem('bottleJumpSave', JSON.stringify(UI.save)); } catch (e) {}
    },
    show: function (name) {
      var UI2 = UI;
      UI2.lastScreen = name === 'settings' ? (UI2.lastScreen || 'menu') : name;
      for (var k in UI2.screens) { var el = UI2.screens[k]; if (el) el.classList.toggle('hidden', k !== name); }
      if (name === 'menu') UI2.refreshMenu();
      document.getElementById('ui-root').style.pointerEvents = 'none';
    },
    refreshMenu: function () {
      var s = UI.save;
      document.getElementById('menu-level-num').textContent = s.level;
      document.getElementById('menu-coins').textContent = s.coins;
      document.getElementById('menu-gems').textContent = s.gems;
    },
    setHud: function (level, coins) {
      document.getElementById('hud-level-num').textContent = level;
      document.getElementById('hud-coins').textContent = coins;
    },
    setDone: function (coins) {
      document.getElementById('done-coins').textContent = '+' + coins;
    },
    toggleSound: function () {
      UI.save.sound = !UI.save.sound;
      Sound.setEnabled(UI.save.sound);
      UI.syncSoundIcon(); UI.persist();
    },
    toggleVibro: function () {
      UI.save.vibro = !UI.save.vibro;
      document.getElementById('img-vibro').src = UI.save.vibro
        ? 'assets/sprites/sharedassets0.assets__706__IcnVibro.png'
        : 'assets/sprites/sharedassets0.assets__767__IcnVibroOff.png';
      UI.persist();
    },
    syncSoundIcon: function () {
      var on = UI.save.sound;
      document.getElementById('img-sound').src = on
        ? 'assets/sprites/sharedassets0.assets__742__IcnSoundOn.png'
        : 'assets/sprites/sharedassets0.assets__768__IcnSoundOff.png';
      var i2 = document.getElementById('img-sound2');
      if (i2) i2.src = on
        ? 'assets/sprites/sharedassets0.assets__742__IcnSoundOn.png'
        : 'assets/sprites/sharedassets0.assets__768__IcnSoundOff.png';
      Sound.setEnabled(on);
    }
  };
  global.UI = UI;
})(window);
