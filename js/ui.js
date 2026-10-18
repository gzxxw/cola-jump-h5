/* UI：屏幕切换 + 存档 + 图鉴（全部使用 APK 原版精灵/字体） */
(function (global) {
  'use strict';
  var UI = {
    screens: {},
    save: { level: 1, coins: 0, gems: 0, sound: true, vibro: true, owned: ['Bottle_1'] },
    skins: [],
    onPlay: null, onRetry: null, onNext: null, onBack: null, onUnlock: null,
    init: function (callbacks, skins) {
      var self = UI;
      self.skins = skins || [];
      self.onPlay = callbacks.play; self.onRetry = callbacks.retry;
      self.onNext = callbacks.next; self.onBack = callbacks.back; self.onMenu = callbacks.menu;
      self.onUnlock = callbacks.unlock; self.onResume = callbacks.resume; self.onOrient = callbacks.orient;
      ['loading', 'menu', 'hud', 'fail', 'done', 'settings', 'vitrine'].forEach(function (n) {
        self.screens[n] = document.getElementById('screen-' + n);
      });
      self.loadSave();
      function bind(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', function (e) { e.stopPropagation(); Sound.play('click'); fn && fn(); }); }
      bind('btn-play', function () { self.show('hud'); self.onPlay && self.onPlay(); });
      bind('btn-vip', function () { self.show('vitrine'); self.renderVitrine(); });
      bind('btn-ads', function () { self.toast('广告已剔除'); });
      bind('btn-settings', function () { self.show('settings'); });
      bind('btn-pause', function () { self.show('settings'); });
      bind('btn-settings-close', function () { if (self.onResume) { self.onResume(); } else { self.show(self.lastScreen || 'menu'); } });
      bind('btn-vitrine-back', function () { self.show('menu'); });
      bind('btn-unlock', function () { self.onUnlock && self.onUnlock(); });
      bind('btn-sound', function () {});
      bind('btn-sound2', function () { self.toggleSound(); });
      bind('btn-vibro', function () { self.toggleVibro(); });
      bind('btn-orient', function () { self.onOrient && self.onOrient(); });
      bind('btn-retry', function () { self.show('hud'); self.onRetry && self.onRetry(); });
      bind('btn-fail-menu', function () { self.show('menu'); self.onMenu && self.onMenu(); });
      bind('btn-next', function () { self.show('hud'); self.onNext && self.onNext(); });
      bind('btn-done-menu', function () { self.show('menu'); self.onMenu && self.onMenu(); });
      bind('btn-back', function () {});
      self.syncSoundIcon(); self.syncOrientLabel();
    },
    loadSave: function () {
      try {
        var s = JSON.parse(localStorage.getItem('bottleJumpSave') || 'null');
        if (s) for (var k in s) if (k in UI.save) UI.save[k] = s[k];
      } catch (e) {}
    },
    persist: function () {
      try { localStorage.setItem('bottleJumpSave', JSON.stringify(UI.save)); } catch (e) {}
    },
    show: function (name) {
      var UI2 = UI;
      UI2.lastScreen = (name === 'settings') ? (UI2.lastScreen || 'menu') : name;
      for (var k in UI2.screens) { var el = UI2.screens[k]; if (el) el.classList.toggle('hidden', k !== name); }
      if (name === 'menu') UI2.refreshMenu();
    },
    refreshMenu: function () {
      var s = UI.save;
      document.getElementById('menu-coins').textContent = s.coins;
    },
    setHud: function (level, coins) {
      document.getElementById('hud-coins').textContent = coins;
      var l = Math.max(0, level - 1), r = level;
      document.getElementById('prog-l').textContent = l;
      document.getElementById('prog-r').textContent = r;
      document.getElementById('prog-r').className = 'num gray';
    },
    setProgress: function (p) {
      var f = document.getElementById('prog-fill');
      if (f) f.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
    },
    setDone: function (coins) {
      document.getElementById('done-coins').textContent = '+' + coins;
    },
    renderVitrine: function () {
      var grid = document.getElementById('vitrine-grid');
      grid.innerHTML = '';
      document.getElementById('vitrine-coins').textContent = UI.save.coins;
      document.getElementById('unlock-cost').textContent = 1000;
      var owned = UI.save.owned || ['Bottle_1'];
      UI.skins.forEach(function (sk) {
        var card = document.createElement('div');
        card.className = 'bottle-card' + (owned.indexOf(sk.name) >= 0 ? ' owned' : ' locked');
        var img = document.createElement('img');
        var isOwned = owned.indexOf(sk.name) >= 0;
        var thumb = (window.__skinThumb && !isOwned) ? window.__skinThumb(sk.png) : null;
        if (isOwned) {
          var th2 = window.__skinThumb ? window.__skinThumb(sk.png) : null;
          img.src = th2 || 'assets/sprites/sharedassets0.assets__702__IcnBottle.png';
        } else if (thumb) {
          img.src = thumb;
        } else {
          img.src = 'assets/sprites/sharedassets0.assets__702__IcnBottle.png';
          img.classList.add('sil');
        }
        img.alt = sk.name;
        card.appendChild(img);
        grid.appendChild(card);
      });
    },
    toast: function (msg) {
      var t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(UI._toastT);
      UI._toastT = setTimeout(function () { t.classList.add('hidden'); }, 1600);
    },
    toggleSound: function () {
      UI.save.sound = !UI.save.sound;
      Sound.setEnabled(UI.save.sound);
      UI.syncSoundIcon(); UI.persist();
    },
    toggleVibro: function () {
      UI.save.vibro = !UI.save.vibro;
      var i2 = document.getElementById('img-vibro');
      if (i2) i2.src = UI.save.vibro
        ? 'assets/sprites/sharedassets0.assets__706__IcnVibro.png'
        : 'assets/sprites/sharedassets0.assets__767__IcnVibroOff.png';
      UI.persist();
    },
    syncOrientLabel: function () {
      var l = document.getElementById('lbl-orient');
      if (l) l.textContent = '横屏模式：' + (window.FORCE_LANDSCAPE ? '开' : '关');
    },
    syncSoundIcon: function () {
      var on = UI.save.sound;
      var i2 = document.getElementById('img-sound2');
      if (i2) i2.src = on
        ? 'assets/sprites/sharedassets0.assets__742__IcnSoundOn.png'
        : 'assets/sprites/sharedassets0.assets__768__IcnSoundOff.png';
      Sound.setEnabled(on);
    }
  };
  global.UI = UI;
})(window);
