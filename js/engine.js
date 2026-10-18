/* 可乐跳跳瓶 H5 — 3D 引擎：从 APK 导出的 prefabs/meshes/materials 重建场景 */
(function (global) {
  'use strict';
  var D = null; // data bundle
  var THREE = null;

  function loadJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }

  function Engine(three, data) { THREE = three; D = data; this.init(); }
  Engine.prototype.init = function () {
    var g = this;
    g.geoCache = {}; g.matCache = {}; g.texCache = {}; g.meshColliders = {};
    g.texLoader = new THREE.TextureLoader();
    g.texLoader.setCrossOrigin('anonymous');
    // 场景灯光（Unity 场景 Directional Light + 环境）
    g.scene = new THREE.Scene();
    var bg = (D.prefabs.cameras && D.prefabs.cameras.filter(function (c) { return c.node === 'DefaultCam'; })[0] || {}).bg;
    var bgc = bg ? new THREE.Color(bg[0], bg[1], bg[2]) : new THREE.Color(0.85, 0.9, 0.98);
    g.scene.background = bgc;
    var hemi = new THREE.HemisphereLight(0xffffff, 0x9a8f80, 1.15);
    hemi.position.set(0, 20, 0);
    g.scene.add(hemi);
    var dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(6, 14, -6);
    dir.target.position.set(0, 0, 0);
    g.scene.add(dir); g.scene.add(dir.target);
    g.dirLight = dir;
    var fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-8, 6, 4); g.scene.add(fill);
    g.roomGroup = new THREE.Group(); g.scene.add(g.roomGroup);
    g.props = [];      // {group, mesh, colliders}
    g.boxColliders = []; // {min:[],max:[]} world
    g.triggers = [];     // coins?
  };

  Engine.prototype.texture = function (path) {
    var g = this;
    if (!path) return null;
    if (g.texCache[path]) return g.texCache[path];
    var t = g.texLoader.load('assets/' + path);
    if (THREE.SRGBColorSpace !== undefined) t.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    g.texCache[path] = t;
    return t;
  };

  Engine.prototype.material = function (mid) {
    var g = this;
    if (g.matCache[mid]) return g.matCache[mid];
    var m = D.materials[mid];
    var opts = {};
    if (!m) { opts.color = 0xff00ff; }
    else {
      var c = m.color || [1, 1, 1, 1];
      opts.color = new THREE.Color(c[0], c[1], c[2]);
      var tex = m.tex ? g.texture(m.tex) : null;
      if (tex) opts.map = tex;
      var fl = m.floats || {};
      opts.roughness = (fl._Glossiness !== undefined) ? Math.min(1, Math.max(0.06, 1 - fl._Glossiness)) : 0.9;
      opts.metalness = fl._Metallic || 0;
      if (fl._Mode !== undefined && fl._Mode >= 2) { opts.transparent = true; opts.opacity = 0.9; opts.depthWrite = false; }
      else if (fl._Mode !== undefined && fl._Mode === 1) { opts.alphaTest = 0.35; opts.transparent = false; }
      if (m.emission && m.emission[0] + m.emission[1] + m.emission[2] > 0.001) {
        opts.emissive = new THREE.Color(m.emission[0], m.emission[1], m.emission[2]);
      }
      if (c[3] < 0.999) { opts.transparent = true; opts.opacity = c[3]; opts.depthWrite = false; }
    }
    var mat = new THREE.MeshStandardMaterial(opts);
    mat.side = THREE.FrontSide;
    g.matCache[mid] = mat;
    return mat;
  };

  Engine.prototype.geometry = function (gid) {
    var g = this;
    if (g.geoCache[gid]) return g.geoCache[gid];
    var m = D.meshes[gid];
    if (!m) return null;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(m.p, 3));
    if (m.n) geo.setAttribute('normal', new THREE.Float32BufferAttribute(m.n, 3));
    if (m.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
    var idx = m.i;
    if (m.p.length / 3 > 65535) geo.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
    else geo.setIndex(idx);
    if (!m.n) geo.computeVertexNormals();
    var subs = m.sub || [];
    var groups = [];
    for (var i = 0; i < subs.length; i++) {
      if (subs[i].count > 0) groups.push([subs[i].start, subs[i].count, i]);
    }
    if (!groups.length && geo.index) groups.push([0, geo.index.count, 0]);
    geo.userData.subGroups = groups;
    geo.computeBoundingSphere();
    g.geoCache[gid] = geo;
    return geo;
  };

  // 合并子网格材质：一个 mesh 实例可能多材质 → 用 groups
  Engine.prototype.meshObject = function (inst) {
    var g = this;
    var geo = g.geometry(inst.m);
    if (!geo) return null;
    var mats = (inst.mats || []).map(function (mid) { return g.material(mid); });
    if (!mats.length) mats = [g.material(null)];
    var subs = geo.userData.subGroups || [[0, geo.index ? geo.index.count : geo.attributes.position.count, 0]];
    // 若材质数与子网格数不一致：按索引取模
    geo.clearGroups();
    for (var i = 0; i < subs.length; i++) {
      var mat = mats[Math.min(i, mats.length - 1)];
      geo.addGroup(subs[i][0], subs[i][1], i < mats.length ? i : 0);
    }
    var obj = new THREE.Mesh(geo, mats.length === 1 ? mats[0] : mats);
    return obj;
  };

  // 把 16 floats (row-major) 应用为 Object3D matrix
  function applyMatrix(obj, x) {
    var m = new THREE.Matrix4();
    m.set(x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[7], x[8], x[9], x[10], x[11], x[12], x[13], x[14], x[15]);
    obj.matrixAutoUpdate = false;
    obj.matrix.copy(m);
    obj.matrixWorldNeedsUpdate = true;
  }

  // 由 16 floats + 本地 size/center 计算世界 AABB
  function boxToAABB(x, size, center) {
    var m = new THREE.Matrix4();
    m.set(x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[7], x[8], x[9], x[10], x[11], x[12], x[13], x[14], x[15]);
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (var sx = -1; sx <= 1; sx += 2) for (var sy = -1; sy <= 1; sy += 2) for (var sz = -1; sz <= 1; sz += 2) {
      var v = new THREE.Vector3(center[0] + sx * size[0] / 2, center[1] + sy * size[1] / 2, center[2] + sz * size[2] / 2);
      v.applyMatrix4(m);
      mn[0] = Math.min(mn[0], v.x); mn[1] = Math.min(mn[1], v.y); mn[2] = Math.min(mn[2], v.z);
      mx[0] = Math.max(mx[0], v.x); mx[1] = Math.max(mx[1], v.y); mx[2] = Math.max(mx[2], v.z);
    }
    return { min: mn, max: mx };
  }

  Engine.prototype.buildPrefab = function (prefab, x, y, z, opts) {
    var g = this;
    opts = opts || {};
    var group = new THREE.Group();
    group.position.set(x || 0, y || 0, z || 0);
    for (var i = 0; i < prefab.meshes.length; i++) {
      var inst = prefab.meshes[i];
      var child = g.meshObject(inst);
      if (!child) continue;
      applyMatrix(child, inst.x);
      child.userData.node = inst.node;
      group.add(child);
    }
    // 碰撞体（转世界 AABB，考虑 group 偏移）
    var off = [x || 0, y || 0, z || 0];
    function shift(aabb) {
      return { min: [aabb.min[0] + off[0], aabb.min[1] + off[1], aabb.min[2] + off[2]],
               max: [aabb.max[0] + off[0], aabb.max[1] + off[1], aabb.max[2] + off[2]] };
    }
    var colliders = [];
    if (!opts.noColliders) {
      for (var c = 0; c < prefab.colliders.length; c++) {
        var col = prefab.colliders[c];
        if (col.t === 'box') colliders.push(shift(boxToAABB(col.x, col.s, col.c)));
        else if (col.t === 'sphere') {
          var p = new THREE.Vector3(col.c[0], col.c[1], col.c[2]);
          var m4 = new THREE.Matrix4();
          m4.set(col.x[0], col.x[1], col.x[2], col.x[3], col.x[4], col.x[5], col.x[6], col.x[7], col.x[8], col.x[9], col.x[10], col.x[11], col.x[12], col.x[13], col.x[14], col.x[15]);
          p.applyMatrix4(m4);
          var r = col.r * m4.getMaxScaleOnAxis();
          colliders.push({ sphere: true, c: [p.x + off[0], p.y + off[1], p.z + off[2]], r: r });
        }
      }
    }
    group.userData.colliders = colliders;
    return { group: group, colliders: colliders };
  };

  Engine.prototype.addPrefab = function (prefab, x, y, z, opts) {
    var built = this.buildPrefab(prefab, x, y, z, opts);
    this.roomGroup.add(built.group);
    for (var i = 0; i < built.colliders.length; i++) this.boxColliders.push(built.colliders[i]);
    return built;
  };

  Engine.prototype.resetLevel = function () {
    // 清理上一关
    var g = this;
    for (var i = g.roomGroup.children.length - 1; i >= 0; i--) g.roomGroup.remove(g.roomGroup.children[i]);
    g.boxColliders.length = 0;
    g.geoCache = {}; // geometry 复用以减少内存：这里保留材质/纹理缓存
  };

  Engine.prototype.resize = function (w, h) {
    this.renderer.setSize(w, h, false);
  };

  global.Engine = Engine;
  global.loadJSON = loadJSON;
})(window);
