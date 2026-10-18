/* 音频：使用 APK 原始 ogg（42 个音效） */
(function (global) {
  'use strict';
  var Sound = {
    enabled: true,
    ctx: null,
    cache: {},
    // 名称 → 文件（assets/audio/<file>）
    map: {
      jump: 'Jump_09.ogg',
      land: 'Toaster_04.ogg',
      coin: 'Coin_25.ogg',
      fail: 'LevelLose_07.ogg',
      done: 'LevelDone_28.ogg',
      click: 'box_03.ogg',
      light: 'LightOn_29.ogg',
      bell: 'bell_10.ogg'
    },
    init: function () { /* 由 game.js 注入 AudioContext */ },
    play: function (key) {
      if (!Sound.enabled) return;
      var file = Sound.map[key];
      if (!file) return;
      var a = Sound.cache[file];
      if (!a) {
        a = new Audio('assets/audio/' + file);
        a.preload = 'auto';
        Sound.cache[file] = a;
      }
      try { a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    },
    setEnabled: function (v) { Sound.enabled = !!v; }
  };
  global.Sound = Sound;
})(window);
