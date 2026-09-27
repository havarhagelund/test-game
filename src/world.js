import * as THREE from 'three';
import { HALF, WALL_H, WALL_T, COLORS } from './config.js';
import { plastic, matte, rbox, cyl, sphere } from './models.js';

export function buildWorld(scene, lowPower) {
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.horizon, 38, 90);

  // Himmel med myk gradient
  const skyGeo = new THREE.SphereGeometry(120, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(0x9fd3ff) }, bottom: { value: new THREE.Color(COLORS.horizon) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = smoothstep(-0.05, 0.55, vP.y); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  scene.add(new THREE.HemisphereLight(0xfff4f8, 0xb6e8c4, 1.35));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
  sun.position.set(4, 17, -10);
  sun.castShadow = true;
  const sm = lowPower ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera;
  sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2;
  scene.add(sun);

  // Gress
  const ground = new THREE.Mesh(new THREE.CircleGeometry(100, 64), matte(COLORS.grass));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  scene.add(ground);

  buildSandbox(scene);
  buildGarden(scene, lowPower);
  return { sun };
}

function buildSandbox(scene) {
  const g = new THREE.Group();
  // Bunnplanker
  const plankMat = matte(COLORS.planks);
  const plankW = (2 * HALF) / 8;
  for (let k = 0; k < 8; k++) {
    const p = rbox(plankW - 0.04, 0.12, 2 * HALF, 0.04, plankMat);
    p.position.set(-HALF + plankW * (k + 0.5), -0.06, 0);
    p.castShadow = false;
    g.add(p);
  }
  // Vegger
  const wallMat = plastic(COLORS.frame, { roughness: 0.6 });
  const L = 2 * HALF + 2 * WALL_T;
  const walls = [
    [0, -HALF - WALL_T / 2, L, WALL_T],
    [0, HALF + WALL_T / 2, L, WALL_T],
    [-HALF - WALL_T / 2, 0, WALL_T, 2 * HALF],
    [HALF + WALL_T / 2, 0, WALL_T, 2 * HALF],
  ];
  for (const [x, z, w, d] of walls) {
    const m = rbox(w, WALL_H + 0.12, d, 0.12, wallMat);
    m.position.set(x, (WALL_H - 0.12) / 2, z);
    g.add(m);
  }
  // Setebenker i hjørnene
  const seatMat = plastic(COLORS.frameTop, { roughness: 0.55 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const s = rbox(1.5, 0.14, 1.5, 0.06, seatMat);
    s.position.set(sx * (HALF - 0.55), WALL_H + 0.02, sz * (HALF - 0.55));
    s.rotation.y = Math.PI / 4;
    s.scale.set(1, 1, 0.5);
    g.add(s);
  }
  // Kantlist på toppen
  const rimMat = plastic(COLORS.frameTop, { roughness: 0.55 });
  for (const [x, z, w, d] of walls) {
    const m = rbox(w + 0.12, 0.1, d + 0.12, 0.05, rimMat);
    m.position.set(x, WALL_H + 0.0, z);
    g.add(m);
  }
  scene.add(g);
}

function lollipopTree(x, z, s, color) {
  const g = new THREE.Group();
  const trunk = cyl(0.18 * s, 0.26 * s, 2.2 * s, matte(0xe0b48f), 12);
  trunk.position.y = 1.1 * s;
  g.add(trunk);
  const top = sphere(1.3 * s, plastic(color, { roughness: 0.7 }), 20);
  top.position.y = 2.9 * s;
  g.add(top);
  const top2 = sphere(0.8 * s, plastic(color, { roughness: 0.7 }), 16);
  top2.position.set(0.7 * s, 2.4 * s, 0.4 * s);
  g.add(top2);
  g.position.set(x, 0, z);
  return g;
}

function bush(x, z, s, color) {
  const g = new THREE.Group();
  const mat = plastic(color, { roughness: 0.75 });
  for (let k = 0; k < 4; k++) {
    const b = sphere((0.55 + Math.random() * 0.35) * s, mat, 14);
    b.position.set((Math.random() - 0.5) * 1.2 * s, 0.35 * s, (Math.random() - 0.5) * 1.2 * s);
    g.add(b);
  }
  g.position.set(x, 0, z);
  return g;
}

function buildGarden(scene, lowPower) {
  const rnd = mulberry(7);
  const treeColors = [0x9ee6a8, 0xb9ecb0, 0xffc9dc, 0xc6f0c0];
  const trees = [[-17, -12, 1.4], [15, -16, 1.7], [19, 6, 1.3], [-20, 10, 1.6], [3, -22, 1.5], [-9, 20, 1.3], [12, 19, 1.5]];
  trees.forEach(([x, z, s], k) => scene.add(lollipopTree(x, z, s, treeColors[k % treeColors.length])));
  const bushColors = [0x8fdca0, 0xa8e8b0, 0x9ad9b8];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + rnd() * 0.3;
    const r = 13 + rnd() * 6;
    scene.add(bush(Math.cos(a) * r, Math.sin(a) * r, 0.8 + rnd() * 0.6, bushColors[k % 3]));
  }

  // Stakittgjerde i ring
  const fenceMat = plastic(0xfffaf4, { roughness: 0.6 });
  const R = 26;
  const count = lowPower ? 90 : 140;
  const picket = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 1.4, 0.1), fenceMat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    p.set(Math.cos(a) * R, 0.7, Math.sin(a) * R);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2);
    m.compose(p, q, s);
    picket.setMatrixAt(k, m);
  }
  picket.castShadow = true;
  scene.add(picket);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 6, 120), fenceMat);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 0.9;
  scene.add(rail);

  // Blomster
  const flowerCols = [0xffb8c9, 0xfff0a0, 0xffffff, 0xd9c9ff];
  const fGeo = new THREE.SphereGeometry(0.12, 8, 6);
  flowerCols.forEach((c) => {
    const n = lowPower ? 25 : 45;
    const im = new THREE.InstancedMesh(fGeo, plastic(c, { roughness: 0.6 }), n);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, r = 11 + rnd() * 14;
      p.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
      m.compose(p, q.identity(), s);
      im.setMatrixAt(k, m);
    }
    scene.add(im);
  });

  // Skyer
  const cloudMat = plastic(0xffffff, { roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 });
  for (let k = 0; k < 6; k++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.4 + rnd() * 1.2, 14, 10), cloudMat);
      b.position.set(j * 1.6 - 2.4, rnd() * 0.6, rnd() * 0.8);
      c.add(b);
    }
    const a = rnd() * Math.PI * 2;
    c.position.set(Math.cos(a) * 55, 20 + rnd() * 10, Math.sin(a) * 55);
    c.lookAt(0, c.position.y, 0);
    scene.add(c);
  }
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

