/* 可乐跳跳瓶 H5 复刻 — 主逻辑
 * 物理/数值来源：APK IL2CPP 反编译 + prefab 序列化数据
 *  PlayerBottleManager: firstKickPower=1, firstKickVector=(2.615,11.138,0),
 *  secondKickPower=1, secondKickVector=(2.615,11.138,0), flips=2,
 *  torqPower=-720, overshootTimeKoeff=1.6, gravity=25.082, speedKoeff=1
 *  CamTrack: trackingObject=Player, offset=(-1,0,0); CamFov: 60/1080x1920
 */
(function () {
  'use strict';
  var THREE = window.THREE;
  var D = null, engine = null, renderer = null, camera = null, clock = null;
  var bottle = null, bottleSpin = { angle: 0, target: 0, start: 0, t: 0, dur: 0, active: false };
  var run = {
    state: 'loading',   // loading | menu | play | fail | done
    level: 1,
    rooms: [], colliders: [], coins: [], coinSprites: [],
    spawn: { x: 0, y: 2, z: 0.182 },
    finishX: 0, minY: -6,
    player: { x: 0, y: 2, z: 0.182, vx: 0, vy: 0, onGround: false, jumps: 0 },
    coinsGot: 0,
    lastTap: 0, tapHintTimer: 0
  };
  var CONST = {
    kick: { x: 2.615, y: 11.138 },
    gravity: 25.082,
    flips: 2,
    overshoot: 1.6,
    halfH: 0.395, halfW: 0.13,
    // 相机：水平正对场景（不倾斜），在玩家后方固定偏移
    // 距离 3.4、高度 2.2，视线水平略微下倾，瓶子约占屏高 1/5
    camOffset: { x: 0.3, y: 2.2, z: -3.4 },
    camLookY: 1.5,
    camFov: 60,
    baseAspect: 1080 / 1920
  };
  var SKINS = [
    {name:'Bottle_1', png:'sharedassets0.assets__245__Bottle_1.png'},
    {name:'SimpleBottle_1', png:'sharedassets0.assets__248__SimpleBottle_1.png'},
    {name:'SimpleBottle_2', png:'sharedassets0.assets__209__SimpleBottle_2.png'},
    {name:'SimpleBottle_3', png:'sharedassets0.assets__247__SimpleBottle_3.png'},
    {name:'SimpleBottle_4', png:'sharedassets0.assets__154__SimpleBottle_4.png'},
    {name:'SimpleBottle_5', png:'sharedassets0.assets__196__SimpleBottle_5.png'},
    {name:'SimpleBottle_6', png:'sharedassets0.assets__100__SimpleBottle_6.png'},
    {name:'SimpleBottle_7', png:'sharedassets0.assets__186__SimpleBottle_7.png'},
    {name:'SimpleBottle_8', png:'sharedassets0.assets__246__SimpleBottle_8.png'},
    {name:'SimpleBottle_9', png:'sharedassets0.assets__244__SimpleBottle_9.png'},
    {name:'SimpleBottle_10', png:'sharedassets0.assets__243__SimpleBottle_10.png'},
    {name:'SimpleBottle_11', png:'sharedassets0.assets__151__SimpleBottle_11.png'},
    {name:'SimpleBottle_12', png:'sharedassets0.assets__136__SimpleBottle_12.png'},
    {name:'SimpleBottle_13', png:'sharedassets0.assets__156__SimpleBottle_13.png'},
    {name:'SimpleBottle_14', png:'sharedassets0.assets__234__SimpleBottle_14.png'},
    {name:'SimpleBottle_15', png:'sharedassets0.assets__108__SimpleBottle_15.png'},
    {name:'SimpleBottle_16', png:'sharedassets0.assets__165__SimpleBottle_16.png'},
    {name:'SimpleBottle_17', png:'sharedassets0.assets__199__SimpleBottle_17.png'},
    {name:'SimpleBottle_18', png:'sharedassets0.assets__140__SimpleBottle_18.png'},
    {name:'SimpleBottle_19', png:'sharedassets0.assets__138__SimpleBottle_19.png'},
    {name:'SimpleBottle_20', png:'sharedassets0.assets__147__SimpleBottle_20.png'},
    {name:'SimpleBottle_21', png:'sharedassets0.assets__230__SimpleBottle_21.png'},
    {name:'SimpleBottle_22', png:'sharedassets0.assets__228__SimpleBottle_22.png'},
    {name:'SimpleBottle_23', png:'sharedassets0.assets__169__SimpleBottle_23.png'},
    {name:'SimpleBottle_24', png:'sharedassets0.assets__242__SimpleBottle_24.png'},
    {name:'SimpleBottle_25', png:'sharedassets0.assets__202__SimpleBottle_25.png'},
    {name:'SimpleBottle_26', png:'sharedassets0.assets__212__SimpleBottle_26.png'},
    {name:'VIPBottle_1', png:'sharedassets0.assets__112__VIPBottle_1.png'},
    {name:'VIPBottle_2', png:'sharedassets0.assets__204__VIPBottle_2.png'},
    {name:'VIPBottle_3', png:'sharedassets0.assets__197__VIPBottle_3.png'},
    {name:'BottleVIP_golden', png:'sharedassets0.assets__238__BottleVIP_golden.png'}
  ];
  var keys = {};

  function loadJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); }); }

  function setLoading(p) {
    var el = document.querySelector('.loading-fill');
    if (el) el.style.width = Math.round(p * 100) + '%';
  }

  function boot() {
    try { if (localStorage.getItem('forceLandscape') === '1') window.FORCE_LANDSCAPE = FORCE_LANDSCAPE = true; } catch (e) {}
    // 分阶段加载，实时反馈进度（不让玩家干等）
    var steps = [
      ['assets/data/meshes.json', 'meshes'],
      ['assets/data/materials.json', 'materials'],
      ['assets/data/prefabs.json', 'prefabs'],
      ['assets/data/levels.json', 'levels'],
      ['assets/data/room_order.json', 'roomOrder']
    ];
    D = {};
    var loaded = 0;
    function nextStep() {
      if (loaded >= steps.length) { afterLoad(); return; }
      var st = steps[loaded];
      loadJSON(st[0]).then(function (data) {
        D[st[1]] = data;
        loaded++;
        setLoading(0.15 + 0.55 * (loaded / steps.length));
        nextStep();
      }).catch(function (e) {
        document.querySelector('.loading-text').textContent = 'LOAD ERROR: ' + st[1];
        console.error(e);
      });
    }
    nextStep();

    function afterLoad() {
      setLoading(0.75);
      initRenderer();
      engine = new Engine(THREE, D);
      engine.renderer = renderer;
      window.__engineRef = engine; window.__renderer = renderer;
      window.__cameraRef = camera; window.__sceneRef = engine.scene;
      engine.scene.background = new THREE.Color(0.8479, 0.8961, 0.9717);
      buildBottle();
      setLoading(0.9);
      UI.init({
        play: function () { startLevel(UI.save.level); },
        retry: function () { startLevel(run.level); },
        next: function () { UI.save.level = Math.min(500, run.level + 1); UI.persist(); startLevel(UI.save.level); },
        back: function () { run.state = 'menu'; engine.resetLevel(); if (menuGroup) menuGroup.visible = true; buildMenuScene(); },
        menu: function () { run.state = 'menu'; engine.resetLevel(); if (menuGroup) menuGroup.visible = true; buildMenuScene(); },
        pause: function () { if (run.state === 'play') { run.prevState = 'play'; run.state = 'pause'; } },
        resume: function () { if (run.prevState === 'play') { run.state = 'play'; run.prevState = null; } UI.show('hud'); },
        orient: function () {
          window.FORCE_LANDSCAPE = FORCE_LANDSCAPE = !FORCE_LANDSCAPE;
          try { localStorage.setItem('forceLandscape', FORCE_LANDSCAPE ? '1' : '0'); } catch (e) {}
          UI.syncOrientLabel(); resize();
        },
        unlock: function () {
          var sv = UI.save;
          if (sv.coins < 1000) { UI.toast('金币不足'); return; }
          var locked = UI.skins.filter(function (sk) { return (sv.owned || []).indexOf(sk.name) < 0; });
          if (!locked.length) { UI.toast('已全部解锁'); return; }
          var pick = locked[Math.floor(Math.random() * locked.length)];
          sv.coins -= 1000; sv.owned.push(pick.name); UI.persist();
          UI.renderVitrine(); UI.toast('解锁: ' + pick.name);
        }
      }, SKINS);
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
      bindInput();
      resize();
      clock = new THREE.Clock();
      buildMenuScene();
      UI.show('menu');
      run.state = 'menu';
      setLoading(1);
      animate();
    }
  }

  function initRenderer() {
    var canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false,
      preserveDrawingBuffer: /capture/.test(location.search) });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (THREE.SRGBColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    camera = new THREE.PerspectiveCamera(CONST.camFov, 16 / 9, 0.3, 1000);
    camera.position.set(CONST.camOffset.x, CONST.camOffset.y, CONST.camOffset.z);
    camera.up.set(0, 1, 0);
    // 立即设置一次尺寸，确保 drawingBuffer 非 0
    resize();
  }

  // 相机保持水平朝向：看向玩家正前方（同一 y 高度），避免画面倾斜
  function applyCamRotation() {
    if (!run.player) return;
    camera.up.set(0, 1, 0);
    camera.lookAt(new THREE.Vector3(run.player.x + CONST.camOffset.x, CONST.camLookY, 0));
  }

  function lookForward(fx, fy, fz) {
    var t = new THREE.Vector3(camera.position.x + fx * 100, camera.position.y + fy * 100, camera.position.z + fz * 100);
    camera.up.set(0, 1, 0);
    camera.lookAt(t);
  }

  window.FORCE_LANDSCAPE = false; var FORCE_LANDSCAPE = false;
  function isPortrait() { return !FORCE_LANDSCAPE && window.innerHeight > window.innerWidth; }
  function resize() {
    var w = window.innerWidth || document.documentElement.clientWidth || 420;
    var h = window.innerHeight || document.documentElement.clientHeight || 887;
    if (w < 10) w = 420;
    if (h < 10) h = 887;
    renderer.setSize(w, h, true);
    camera.aspect = w / h;
    // 原版竖屏 1080x1920 fov60；横屏时保持同样的水平视角，换算垂直 fov
    var baseAspect = CONST.baseAspect;
    var hfov = 2 * Math.atan(Math.tan(CONST.camFov * Math.PI / 360) * baseAspect);
    var vfov = 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect) * 180 / Math.PI;
    camera.fov = Math.max(30, Math.min(100, vfov));
    camera.updateProjectionMatrix();
  }

  function bottleMaterialFromNode(matId) { return engine.material(matId); }

  var menuGroup = null;
  function buildMenuScene() {
    if (!engine || menuGroup) return;
    menuGroup = new THREE.Group();
    // 1) 砖墙背景（用原版墙纸贴图，铺满整个视野）
    var wtex = engine.texture('textures/sharedassets0.assets__219__wallpaper2.png');
    if (wtex) { wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(4, 3); }
    var wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 40),
        new THREE.MeshStandardMaterial({ map: wtex, color: 0xffffff, roughness: 0.95 }));
    wall.position.set(0, 10, 2);
    menuGroup.add(wall);
    // 2) 地面（浅蓝紫，与原版一致）
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30),
        new THREE.MeshStandardMaterial({ color: 0x9fa8d8, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -6);
    menuGroup.add(floor);
    // 3) 彩色方块塔（原版主菜单：瓶子站在 4 块彩色积木上）
    var palette = [0xd94b3f, 0x4f9c46, 0xd8a92c, 0x8b5cb8];
    var y = 0;
    var specs = [{s:[1.5,0.5,1.5], c:palette[3]}, {s:[0.55,0.55,0.55], c:palette[0]},
                 {s:[0.55,0.55,0.55], c:palette[1]}, {s:[0.55,0.55,0.55], c:palette[2]}];
    for (var i = 0; i < specs.length; i++) {
      var sp = specs[i];
      var box = new THREE.Mesh(new THREE.BoxGeometry(sp.s[0], sp.s[1], sp.s[2]),
          new THREE.MeshStandardMaterial({ color: sp.c, roughness: 0.75 }));
      box.position.set(0, y + sp.s[1] / 2, 0);
      menuGroup.add(box);
      y += sp.s[1];
    }
    // 4) 瓶子站在塔顶
    if (bottle && bottle.children.length) {
      var b = bottle.clone(true);
      b.visible = true;
      b.position.set(0, y, 0.1);
      b.rotation.set(0, 0, 0);
      menuGroup.add(b);
    }
    // 5) 灯光（菜单独立打光，保证亮度）
    var ml = new THREE.DirectionalLight(0xffffff, 1.15);
    ml.position.set(3, 8, -4); menuGroup.add(ml);
    var mh = new THREE.HemisphereLight(0xffffff, 0xb8b0a0, 1.05);
    menuGroup.add(mh);
    engine.scene.add(menuGroup);
  }

  function buildBottle() {
    var P = D.prefabs.Player;
    bottle = new THREE.Group();
    var seenBody = 0;
    for (var i = 0; i < P.meshes.length; i++) {
      var inst = P.meshes[i];
      // BottleDefault_new 是备用皮，跳过避免重叠
      if (inst.node === 'Bottle_1') {
        seenBody++;
        if (seenBody === 1) continue; // 第一份是 BottleDefault_new 里的
      }
      var obj = engine.meshObject(inst);
      if (!obj) continue;
      var m = new THREE.Matrix4();
      m.set(inst.x[0], inst.x[1], inst.x[2], inst.x[3], inst.x[4], inst.x[5], inst.x[6], inst.x[7],
            inst.x[8], inst.x[9], inst.x[10], inst.x[11], inst.x[12], inst.x[13], inst.x[14], inst.x[15]);
      obj.matrixAutoUpdate = false; obj.matrix.copy(m); obj.matrixWorldNeedsUpdate = true;
      bottle.add(obj);
    }
    bottle.userData.node = 'player';
    engine.scene.add(bottle);
    bottle.visible = false;
  }

  function roomLength(p) {
    var e = p.points && p.points.EndPoint;
    return (e && e[0] > 0) ? e[0] : 10;
  }

  function buildLevel(levelNum) {
    engine.resetLevel();
    run.coins = []; run.coinSprites = [];
    var lv = D.levels.levels[Math.max(0, Math.min(D.levels.levels.length - 1, levelNum - 1))];
    var seq = [];
    var fixed = D.prefabs.fixed || [];
    if (!(lv.rooms && lv.rooms.length) && fixed.length) {
      // 教程关（levelsNums 为空）：原版用手工固定房间，9 间/关
      var half = Math.ceil(fixed.length / 2);
      var part = (levelNum <= 1) ? fixed.slice(0, half) : fixed.slice(half, half * 2);
      part.forEach(function (p) { seq.push(p); });
    } else {
      (lv.rooms || []).forEach(function (name) {
        var seg = null;
        for (var i = 0; i < D.prefabs.segments.length; i++) { if (D.prefabs.segments[i].name === name) { seg = D.prefabs.segments[i]; break; } }
        if (seg) seq.push(seg);
      });
    }
    if (!seq.length) seq.push(D.prefabs.Room_Empty);
    var cursor = 0;
    run.rooms = [];
    for (var i = 0; i < seq.length; i++) {
      var prefab = seq[i];
      var built = engine.addPrefab(prefab, cursor, 0, 0);
      run.rooms.push({ prefab: prefab, x: cursor });
      // 金币
      (prefab.coins || []).forEach(function (c) {
        run.coins.push({ x: cursor + c.pos[0], y: c.pos[1], z: c.pos[2] || 0.18, taken: false });
      });
      cursor += roomLength(prefab);
    }
    var lastStart = 0, lastPrefab = null, lastLen = 0;
    (function () {
      var acc = 0;
      for (var i2 = 0; i2 < seq.length; i2++) {
        var L = roomLength(seq[i2]);
        if (i2 === seq.length - 1) { lastStart = acc; lastLen = L; lastPrefab = seq[i2]; }
        acc += L;
      }
    })();
    var lp = (lastPrefab && lastPrefab.points) || {};
    var fp = lp.FinishPos || lp.EndPoint || [4, 1.5, 0];
    // FinishPos 可能超出房间长度（原版按 EndPoint 判定），取两者较小值保证可达
    var localFinish = Math.min(fp[0], lastLen);
    run.finishX = lastStart + localFinish;
    run.colliders = engine.boxColliders;
    // 出生点：第一个真实房间的 SpawnPoint（与 prefab 数据一致）
    var firstRoom = seq[0] || D.prefabs.Room_Empty;
    var sp = (firstRoom.points && firstRoom.points.SpawnPoint) || [1.4, 2.0, 0.182];
    run.spawn = { x: sp[0], y: sp[1], z: sp[2] || 0.182 };
    // 金币：用原版 Bottle_Cap 3D 网格（不是 UI 图标）
    var capMeshId = null, capMatId = null;
    for (var pi = 0; pi < (D.prefabs.Player.meshes || []).length; pi++) {
      var pm = D.prefabs.Player.meshes[pi];
      if (pm.node === 'Items_Beer_02') { capMatId = pm.mats[0]; }
    }
    // 从房间 prefab 里找 Bottle_Cap 的网格
    for (var ri = 0; ri < D.prefabs.segments.length && !capMeshId; ri++) {
      var rm = D.prefabs.segments[ri].meshes || [];
      for (var mi = 0; mi < rm.length; mi++) {
        if (rm[mi].node === 'Bottle_Cap') { capMeshId = rm[mi].m; break; }
      }
    }
    var coinGeo = capMeshId ? engine.geometry(capMeshId) : null;
    var coinMat = new THREE.MeshStandardMaterial({ color: 0xffc21a, metalness: 0.45, roughness: 0.35 });
    for (var ci = 0; ci < run.coins.length; ci++) {
      var c = run.coins[ci];
      var spr;
      if (coinGeo) {
        spr = new THREE.Mesh(coinGeo, coinMat);
        spr.scale.set(1.1, 1.1, 1.1);
        // 让金币面向镜头（绕 X 轴立起来）
        spr.rotation.x = Math.PI / 2;
      } else {
        var coinTex = engine.texture('sprites/sharedassets0.assets__717__IcnCap.png');
        spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: coinTex, transparent: true, depthWrite: false }));
        spr.scale.set(0.5, 0.5, 1);
      }
      spr.position.set(c.x, c.y, c.z);
      spr.visible = false;
      engine.scene.add(spr);
      run.coinSprites.push(spr);
    }
    for (var k = 0; k < run.coinSprites.length; k++) run.coinSprites[k].visible = true;
  }

  function startLevel(n) {
    run.level = Math.max(1, Math.min(500, n));
    UI.save.level = run.level; UI.persist();
    buildLevel(run.level);
    run.levelStartX = 0;
    if (menuGroup) menuGroup.visible = false;
    run.player = { x: run.spawn.x, y: run.spawn.y, z: run.spawn.z, vx: 0, vy: 0, onGround: false, jumps: 0 };
    bottleSpin = { angle: 0, target: 0, start: 0, t: 0, dur: 0, active: false };
    bottle.visible = true;
    run.coinsGot = 0;
    run.blockedTime = 0;
    run.state = 'play';
    UI.setHud(run.level, 0);
    UI.show('hud');
    document.getElementById('tap-hint').classList.remove('hidden');
    camera.position.set(run.player.x + CONST.camOffset.x, CONST.camOffset.y, CONST.camOffset.z);
    applyCamRotation();
  }

  function tap() {
    if (run.state !== 'play') return;
    var p = run.player;
    if (p.onGround || p.jumps < CONST.flips) {
      p.vx = CONST.kick.x;
      p.vy = CONST.kick.y;
      p.onGround = false;
      p.jumps++;
      // 旋转：一次完整翻转，时长 = |vy|/gravity*overshoot
      bottleSpin.dur = Math.abs(p.vy) / CONST.gravity * CONST.overshoot;
      bottleSpin.t = 0;
      bottleSpin.start = bottleSpin.angle;
      bottleSpin.target = bottleSpin.angle - 360;
      bottleSpin.active = true;
      Sound.play('jump');
      var th = document.getElementById('tap-hint');
      if (th) th.classList.add('hidden');
    }
  }

  function aabbOfBottle(p) {
    return { minX: p.x - CONST.halfW, maxX: p.x + CONST.halfW,
             minY: p.y - CONST.halfH, maxY: p.y + CONST.halfH,
             minZ: p.z - CONST.halfW, maxZ: p.z + CONST.halfW };
  }

  function physicsStep(dt) {
    var p = run.player;
    var prev = { x: p.x, y: p.y };
    if (!p.onGround) p.vy -= CONST.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    var landed = false, blocked = false;
    for (var i = 0; i < run.colliders.length; i++) {
      var c = run.colliders[i];
      if (!c.min) continue;
      var halfW = CONST.halfW, halfH = CONST.halfH;
      var bb = { minX: p.x - halfW, maxX: p.x + halfW, minY: p.y - halfH, maxY: p.y + halfH,
                 minZ: p.z - halfW, maxZ: p.z + halfW };
      var ox = Math.min(bb.maxX, c.max[0]) - Math.max(bb.minX, c.min[0]);
      var oy = Math.min(bb.maxY, c.max[1]) - Math.max(bb.minY, c.min[1]);
      var oz = Math.min(bb.maxZ, c.max[2]) - Math.max(bb.minZ, c.min[2]);
      // 三个轴都必须重叠才算碰撞（墙在 z=0.5 平面，玩家在 z≈0.18，不应被墙挡住）
      if (ox <= 0 || oy <= 0 || oz <= 0.02) continue;
      var boxCY = (c.min[1] + c.max[1]) / 2;
      var fromTop = (p.y > boxCY) && (prev.y - halfH >= c.max[1] - 0.12 || p.vy <= 0);
      if (oy <= ox * 1.05 && oy <= oz * 1.05) {
        if (fromTop) { p.y = c.max[1] + halfH; p.vy = 0; landed = true; }
        else if (p.vy > 0) { p.y = c.min[1] - halfH; p.vy = 0; }
        else { p.y = c.max[1] + halfH; p.vy = 0; landed = true; }
      } else {
        var gap = c.max[1] - (p.y - CONST.halfH);      // 障碍顶面高出脚底多少
        if (gap <= 0.85) {                              // 可迈上的台阶/家具沿
          p.y = c.max[1] + CONST.halfH;
          p.vy = 0; landed = true;
        } else {                                        // 太高的侧墙：阻挡
          if (Math.abs(p.x - prev.x) < 1e-6 || p.vx > 0) p.x = c.min[0] - CONST.halfW - 0.001;
          else p.x = c.max[0] + CONST.halfW + 0.001;
          p.vx = 0; blocked = true;
          if (p.vy > 0) p.vy = 0;
        }
      }
    }
    if (landed) {
      p.onGround = true; p.jumps = 0; p.vx = 0; p.vy = 0;
      run.blockedTime = 0;
      bottleSpin.angle = Math.round(bottleSpin.angle / 360) * 360;
      bottleSpin.active = false;
      Sound.play('land');
    } else if (blocked) {
      p.onGround = false;
      run.blockedTime = (run.blockedTime || 0) + dt;
      if (run.blockedTime > 4.0) { die('stuck'); return; }
    } else {
      p.onGround = false;
      run.blockedTime = 0;
    }
    if (p.y < run.minY) { die('fall'); return; }
    // 金币
    for (var q = 0; q < run.coins.length; q++) {
      var co = run.coins[q];
      if (co.taken) continue;
      var dx = co.x - p.x, dy = co.y - p.y;
      // 3D 距离判定（瓶子半高 0.4 + 金币半径 0.3 + 余量）
      if (dx * dx + dy * dy < 1.44) {
        co.taken = true; run.coinsGot++; Sound.play('coin');
        run.coinSprites[q].visible = false;
        UI.setHud(run.level, run.coinsGot);
      }
    }
    if (p.x >= run.finishX && run.state === 'play') { win(); return; }
  }

  function updateSpin(dt) {
    if (!bottleSpin.active) return;
    bottleSpin.t += dt;
    var t = Math.min(1, bottleSpin.t / bottleSpin.dur);
    // 缓出（easeOutQuart，对应原版 easeOQuart / overshoot）
    var e = 1 - Math.pow(1 - t, 4);
    bottleSpin.angle = bottleSpin.start + (bottleSpin.target - bottleSpin.start) * e;
    if (t >= 1) { bottleSpin.start = bottleSpin.target; bottleSpin.active = false; }
  }

  function die(reason) {
    if (run.state !== 'play') return;
    run.state = 'fail';
    Sound.play('fail');
    bottle.visible = true;
    UI.show('fail');
  }

  function win() {
    if (run.state !== 'play') return;
    run.state = 'done';
    Sound.play('done');
    UI.save.coins += run.coinsGot;
    UI.save.level = Math.min(500, run.level + 1);
    UI.persist();
    UI.setDone(run.coinsGot);
    UI.show('done');
  }

  window.__frames = 0;
  function animate() {
    requestAnimationFrame(animate);
    window.__frames++;
    var dt = Math.min(0.05, clock.getDelta());
    if (run.state === 'play') {
      var steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      for (var s = 0; s < steps; s++) { physicsStep(dt / steps); if (run.state !== 'play') break; }
      if (run.state === 'play') updateSpin(dt);
    }
    if (bottle) {
      bottle.position.set(run.player.x, run.player.y, run.player.z);
      bottle.rotation.z = bottleSpin.angle * Math.PI / 180;
    }
    if (run.state === 'play' && run.levelStartX !== undefined) {
      var total = Math.max(1, run.finishX - run.levelStartX);
      UI.setProgress(Math.min(1, Math.max(0, (run.player.x - run.levelStartX) / total)));
    }
    // 相机
    if (run.state === 'menu' && menuGroup) {
      camera.position.set(0, 2.2, -5.0);
      camera.lookAt(new THREE.Vector3(0, 1.6, 0));
      camera.updateProjectionMatrix();
    }
    if (!window.__freeCam && (run.state === 'play' || run.state === 'fail' || run.state === 'done')) {
      // 相机跟随玩家（左后方，平滑）
      var camX = run.player.x + CONST.camOffset.x;
      camera.position.x += (camX - camera.position.x) * Math.min(1, dt * 8);
      camera.position.y = CONST.camOffset.y;
      camera.position.z = CONST.camOffset.z;
      applyCamRotation();
    }
    if (engine) renderer.render(engine.scene, camera);
  }

  function bindInput() {
    var stage = document.getElementById('stage');
    stage.addEventListener('pointerdown', function (e) {
      if (run.state === 'play') { tap(); }
    });
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') {
        e.preventDefault();
        if (run.state === 'play') tap();
      }
      if (e.code === 'KeyR' && run.state === 'play') startLevel(run.level);
    });
    window.addEventListener('keyup', function () {});
  }

  window.__engineRef = null;
  window.__renderer = null;
  window.__dbg = function () {
    if (!engine) return null;
    var box = new THREE.Box3();
    engine.roomGroup.traverse(function (o) { if (o.isMesh) box.expandByObject(o); });
    var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    return {
      camPos: [camera.position.x, camera.position.y, camera.position.z],
      camDir: [dir.x, dir.y, dir.z], fov: camera.fov,
      roomBox: box.isEmpty() ? null : { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] },
      player: [run.player.x, run.player.y, run.player.z], state: run.state, og: run.player.onGround, jumps: run.player.jumps, blocked: run.blockedTime||0,
      rooms: run.rooms.length, colliders: run.colliders.length,
      camTarget: (window.__camTest||null)
    };
  };
  window.__setCam = function (x, y, z, tx, ty, tz) {
    window.__freeCam = true;
    camera.position.set(x, y, z); camera.up.set(0, 1, 0); camera.lookAt(new THREE.Vector3(tx, ty, tz));
    camera.updateProjectionMatrix(); window.__camTest = [x,y,z,tx,ty,tz];
  };
  var thumbCache = {};
  function skinThumb(png) {
    if (thumbCache[png] !== undefined) return thumbCache[png];
    // WebGL 不可用时直接返回 null（走贴图回退）
    try {
      var _gl = renderer && renderer.getContext && renderer.getContext();
      if (!_gl || _gl.isContextLost()) { thumbCache[png] = null; return null; }
    } catch (e) { thumbCache[png] = null; return null; }
    try {
      var geo = null;
      for (var i = 0; i < D.prefabs.Player.meshes.length; i++) {
        var im = D.prefabs.Player.meshes[i];
        if (im.node === 'Bottle_1') { geo = engine.geometry(im.m); break; }
      }
      if (!geo) { thumbCache[png] = null; return null; }
      var sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xffffff, 0x999999, 1.25));
      var dl = new THREE.DirectionalLight(0xffffff, 0.95); dl.position.set(2, 3, -3); sc.add(dl);
      var mat = new THREE.MeshStandardMaterial({ map: engine.texture('textures/' + png), roughness: 0.55, metalness: 0.05 });
      var mesh = new THREE.Mesh(geo, mat);
      geo.computeBoundingBox();
      var bb = geo.boundingBox, ctr = bb.getCenter(new THREE.Vector3());
      mesh.position.set(-ctr.x, -ctr.y, -ctr.z);
      sc.add(mesh);
      var cam = new THREE.PerspectiveCamera(30, 96 / 128, 0.05, 50);
      cam.position.set(0, 0, -3.0); cam.lookAt(new THREE.Vector3(0, 0, 0));
      var rt = new THREE.WebGLRenderTarget(96, 128);
      renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.setRenderTarget(null);
      var buf = new Uint8Array(96 * 128 * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, 96, 128, buf);
      var cv = document.createElement('canvas'); cv.width = 96; cv.height = 128;
      var ctx = cv.getContext('2d'); var img2 = ctx.createImageData(96, 128);
      for (var y = 0; y < 128; y++) img2.data.set(buf.subarray((127 - y) * 96 * 4, (128 - y) * 96 * 4), y * 96 * 4);
      ctx.putImageData(img2, 0, 0);
      var url = cv.toDataURL('image/png');
      rt.dispose(); thumbCache[png] = url;
      return url;
    } catch (e) { thumbCache[png] = null; return null; }
  }
  window.__skinThumb = skinThumb;
  window.addEventListener('DOMContentLoaded', boot);
})();
