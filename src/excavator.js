import * as THREE from 'three';
import { COLORS, WALL_H, HALF } from './config.js';
import { Vehicle } from './vehicle.js';
import { plastic, rbox, cyl, sphere, wheel, shadowed, Piston } from './models.js';

const L1 = 2.1, L2 = 1.5, L3 = 0.62, D = 0.34, W = 0.8;
const PIVOT = new THREE.Vector2(0.55, 0.55); // bommens festepunkt i overvognen (x fram, y opp)
const A1 = [-0.8, 1.2];
const S = [-2.65, -0.3];
const B = [-2.3, 1.35];
export const BUCKET_CAP = 0.28;
const CARRY = 2.55; // absolutt skuffvinkel når den bærer (åpning opp)
const DUMP = -0.45; // åpning ned

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class Excavator extends Vehicle {
  constructor(sand, grains) {
    super(sand, { length: 2.1, width: 1.7, radius: 1.15 });
    this.grains = grains;
    this.kind = 'excavator';
    this.swing = 0;
    this.a1 = 0.35; this.s = -1.6; this.b = -1.4;
    this.fill = 0;
    this.dumping = false;
    this.castleType = 0;
    this.dig = 0; // hvor mye sand som ble flyttet sist (til lyd/motstand)
    this.pour = 0;
    this.armMotion = 0;
    this.trackPhase = 0;
    this.prevBucket = new THREE.Vector3();
    this.bucketVel = new THREE.Vector3();
    this.anchors = [];
    this.build();
    this.setWristFromAngles();
  }

  build() {
    const yellow = plastic(COLORS.yellow), deep = plastic(COLORS.yellowDeep);
    const lilac = plastic(COLORS.lilac, { roughness: 0.6 }), dark = plastic(COLORS.lilacDark, { roughness: 0.7 });
    const cream = plastic(COLORS.cream), pink = plastic(COLORS.pink);
    const glass = plastic(COLORS.glass, { roughness: 0.15, transparent: true, opacity: 0.8 });
    const steel = plastic(0xf3eefc, { roughness: 0.25 });
    const r = this.root;

    // Belter
    this.wheels = [];
    for (const z of [-0.62, 0.62]) {
      const t = rbox(2.15, 0.46, 0.42, 0.2, dark);
      t.position.set(0, 0.24, z);
      r.add(t);
      for (const x of [-0.72, -0.24, 0.24, 0.72]) {
        const w = wheel(0.16, 0.1, lilac, cream);
        w.position.set(x, 0.24, z + Math.sign(z) * 0.2);
        r.add(w);
        this.wheels.push(w);
      }
    }
    const under = rbox(1.2, 0.26, 0.9, 0.08, lilac);
    under.position.y = 0.38;
    r.add(under);
    this.anchor(r, [0, 0.3, 0], [1.05, 0.28, 0.8]);

    // Overvogn
    const up = (this.upper = new THREE.Group());
    up.position.y = 0.52;
    r.add(up);
    const ring = cyl(0.55, 0.55, 0.1, lilac);
    ring.position.y = 0.02;
    up.add(ring);
    const body = rbox(1.75, 0.5, 1.45, 0.16, yellow);
    body.position.set(-0.15, 0.3, 0);
    up.add(body);
    const cw = rbox(0.42, 0.52, 1.4, 0.18, pink);
    cw.position.set(-0.95, 0.34, 0);
    up.add(cw);
    const cab = rbox(0.82, 0.78, 0.66, 0.14, yellow);
    cab.position.set(0.18, 0.92, -0.36);
    up.add(cab);
    const win = rbox(0.7, 0.5, 0.7, 0.1, glass);
    win.position.set(0.24, 0.98, -0.36);
    up.add(win);
    const roof = rbox(0.92, 0.1, 0.74, 0.05, deep);
    roof.position.set(0.18, 1.33, -0.36);
    up.add(roof);
    const hood = rbox(0.9, 0.28, 0.6, 0.12, deep);
    hood.position.set(-0.5, 0.64, 0.3);
    up.add(hood);
    const pipe = cyl(0.05, 0.05, 0.4, dark, 10);
    pipe.position.set(-0.35, 0.95, 0.52);
    up.add(pipe);
    const lamp = sphere(0.07, plastic(0xffffff, { emissive: 0xfff3c0, emissiveIntensity: 0.6 }), 10);
    lamp.position.set(0.62, 1.2, -0.62);
    up.add(lamp);
    // lille fører
    const head = sphere(0.14, plastic(COLORS.peach), 14);
    head.position.set(0.12, 1.0, -0.36);
    up.add(head);
    const helmet = sphere(0.15, plastic(COLORS.pink), 14);
    helmet.scale.y = 0.6;
    helmet.position.set(0.12, 1.08, -0.36);
    up.add(helmet);
    this.anchor(up, [-0.2, 0.45, 0], [0.95, 0.4, 0.72]);

    // Bom
    const boom = (this.boom = new THREE.Group());
    boom.position.set(PIVOT.x, PIVOT.y, 0.22);
    up.add(boom);
    const bm = rbox(L1 + 0.2, 0.28, 0.3, 0.12, yellow);
    bm.position.x = L1 / 2;
    boom.add(bm);
    const pin1 = cyl(0.1, 0.1, 0.36, steel, 12);
    pin1.rotation.x = Math.PI / 2;
    boom.add(pin1);
    this.anchor(boom, [L1 / 2, 0, 0], [L1 / 2, 0.15, 0.16]);

    const stick = (this.stick = new THREE.Group());
    stick.position.x = L1;
    boom.add(stick);
    const sm = rbox(L2 + 0.3, 0.22, 0.24, 0.1, deep);
    sm.position.x = L2 / 2 - 0.15;
    stick.add(sm);
    const pin2 = pin1.clone();
    stick.add(pin2);
    this.anchor(stick, [L2 / 2, 0, 0], [L2 / 2, 0.12, 0.13]);

    const bucket = (this.bucket = new THREE.Group());
    bucket.position.x = L2;
    stick.add(bucket);
    this.buildBucket(bucket, pink, steel);
    this.anchor(bucket, [L3 / 2, D / 2, 0], [L3 / 2, D / 2, W / 2]);

    this.pistons = [new Piston(up, 0.07, lilac, steel), new Piston(up, 0.06, lilac, steel), new Piston(up, 0.05, lilac, steel)];
  }

  buildBucket(g, mat, steel) {
    const outer = (t) => {
      // kubisk bezier fra (0,0) til (L3,0) som buler mot +y
      const p0 = [0, 0], p1 = [-0.05, D * 1.35], p2 = [L3 * 0.75, D * 1.3], p3 = [L3, 0];
      const u = 1 - t;
      const b = (i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i];
      return [b(0), b(1)];
    };
    this.outer = outer;
    const band = new THREE.Shape();
    const n = 20;
    for (let k = 0; k <= n; k++) { const [x, y] = outer(k / n); k ? band.lineTo(x, y) : band.moveTo(x, y); }
    for (let k = n; k >= 0; k--) {
      const [x, y] = outer(k / n);
      const cx = L3 * 0.45, cy = D * 0.2;
      band.lineTo(cx + (x - cx) * 0.86, cy + (y - cy) * 0.86);
    }
    const shell = shadowed(new THREE.Mesh(new THREE.ExtrudeGeometry(band, { depth: W, bevelEnabled: false }), mat));
    shell.position.z = -W / 2;
    g.add(shell);
    const side = new THREE.Shape();
    for (let k = 0; k <= n; k++) { const [x, y] = outer(k / n); k ? side.lineTo(x, y) : side.moveTo(x, y); }
    side.lineTo(0, 0);
    const sideGeo = new THREE.ExtrudeGeometry(side, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
    for (const z of [-W / 2 - 0.02, W / 2 - 0.03]) {
      const s = shadowed(new THREE.Mesh(sideGeo, mat));
      s.position.z = z;
      g.add(s);
    }
    for (let k = 0; k < 4; k++) {
      const tooth = cyl(0.0, 0.05, 0.14, steel, 8);
      tooth.rotation.z = -Math.PI / 2;
      tooth.position.set(L3 + 0.05, 0.02, -W * 0.36 + (k * W * 0.72) / 3);
      g.add(tooth);
    }
    const mount = rbox(0.2, 0.16, 0.3, 0.05, plastic(COLORS.lilac));
    mount.position.set(0.02, 0.08, 0);
    g.add(mount);
    // Sandlass
    this.load = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), plastic(COLORS.sand, { roughness: 1 })));
    this.load.visible = false;
    g.add(this.load);
  }

  anchor(parent, offset, half) {
    const o = new THREE.Object3D();
    o.position.set(...offset);
    parent.add(o);
    this.anchors.push({ obj: o, half });
  }

  // Håndleddets posisjon (stikkens ende) i overvognens plan
  fk(a1 = this.a1, s = this.s) {
    const a2 = a1 + s;
    return new THREE.Vector2(PIVOT.x + L1 * Math.cos(a1) + L2 * Math.cos(a2), PIVOT.y + L1 * Math.sin(a1) + L2 * Math.sin(a2));
  }

  setWristFromAngles() { this.wrist = this.fk(); }

  ik(w) {
    const dx = w.x - PIVOT.x, dy = w.y - PIVOT.y;
    const d = Math.hypot(dx, dy);
    if (d > L1 + L2 - 0.02 || d < Math.abs(L1 - L2) + 0.15) return null;
    const a1 = Math.atan2(dy, dx) + Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
    const ex = PIVOT.x + L1 * Math.cos(a1), ey = PIVOT.y + L1 * Math.sin(a1);
    const s = wrap(Math.atan2(w.y - ey, w.x - ex) - a1);
    if (a1 < A1[0] || a1 > A1[1] || s < S[0] || s > S[1]) return null;
    return { a1, s };
  }

  poseArm() {
    this.upper.rotation.y = this.swing;
    this.boom.rotation.z = this.a1;
    this.stick.rotation.z = this.s;
    this.bucket.rotation.z = this.b;
    this.root.updateMatrixWorld(true);
  }

  // Punkter på skuffens underside i verdensrom
  bucketPoints() {
    const pts = [];
    const m = this.bucket.matrixWorld;
    for (let k = 1; k <= 6; k++) {
      const [x, y] = this.outer(k / 6);
      for (let j = 0; j < 5; j++) {
        pts.push(new THREE.Vector3(x, y, -W / 2 + 0.08 + (j * (W - 0.16)) / 4).applyMatrix4(m));
      }
    }
    for (let j = 0; j < 4; j++) pts.push(new THREE.Vector3(L3 + 0.1, 0, -W * 0.36 + (j * W * 0.72) / 3).applyMatrix4(m));
    return pts;
  }

  // Hvor mye skuffen er inne i bunnen eller veggene (0 = lovlig)
  armPenalty() {
    let pen = 0;
    for (const p of this.bucketPoints()) {
      if (p.y < 0.03) pen += 0.03 - p.y;
      const out = Math.max(Math.abs(p.x), Math.abs(p.z)) - (HALF - 0.05);
      if (out > 0 && p.y < WALL_H + 0.15) pen += Math.min(out, WALL_H + 0.15 - p.y);
    }
    return pen;
  }

  mouth() {
    return new THREE.Vector3(0, -1, 0).transformDirection(this.bucket.matrixWorld);
  }

  update(dt, inp, expert) {
    // Kjøring
    let speed, yawRate;
    if (expert) {
      speed = ((inp.trackL + inp.trackR) / 2) * 1.8;
      yawRate = (inp.trackR - inp.trackL) * 0.9;
    } else {
      speed = inp.ly * 1.8;
      yawRate = -inp.lx * 1.3;
    }
    this.drive(dt, speed, yawRate, 3);
    this.trackPhase += (Math.abs(this.speed) + Math.abs(yawRate) * 0.6) * dt;
    for (const w of this.wheels) w.rotation.z -= (this.speed * dt) / 0.16;

    // Arm
    const resist = 1 - Math.min(0.65, this.dig * 25);
    const penBefore = this.armPenalty();
    const prev = { swing: this.swing, a1: this.a1, s: this.s, b: this.b, wrist: this.wrist.clone() };
    if (expert) {
      this.swing -= inp.lx * 1.0 * dt * resist;
      this.s = clamp(this.s + inp.ly * 1.1 * dt * resist, S[0], S[1]);
      this.a1 = clamp(this.a1 - inp.ry * 0.8 * dt * resist, A1[0], A1[1]);
      this.b = clamp(this.b + inp.rx * 1.8 * dt, B[0], B[1]);
      this.setWristFromAngles();
    } else {
      this.swing -= inp.rx * 1.2 * dt * resist;
      const w = this.wrist.clone();
      w.y += inp.ry * 1.6 * dt * resist;
      w.x += inp.reach * 1.7 * dt * resist;
      const sol = this.ik(w);
      if (sol) { this.a1 = sol.a1; this.s = sol.s; this.wrist = w; }
      const target = clamp(wrap((this.dumping ? DUMP : CARRY) - (this.a1 + this.s)), B[0], B[1]);
      const db = target - this.b;
      this.b += Math.sign(db) * Math.min(Math.abs(db), 3.2 * dt);
    }
    this.poseArm();
    if (this.armPenalty() > penBefore + 1e-5) {
      Object.assign(this, { swing: prev.swing, a1: prev.a1, s: prev.s, b: prev.b, wrist: prev.wrist });
      this.poseArm();
    }
    this.armMotion = Math.abs(this.swing - prev.swing) + Math.abs(this.a1 - prev.a1) + Math.abs(this.s - prev.s) + Math.abs(this.b - prev.b);
    this.armMotion /= Math.max(dt, 1e-3);

    this.updatePistons();
    this.interactSand(dt);
    this.updateLoad();
  }

  interactSand(dt) {
    const center = new THREE.Vector3(L3 * 0.5, D * 0.4, 0).applyMatrix4(this.bucket.matrixWorld);
    this.bucketVel.subVectors(center, this.prevBucket).divideScalar(Math.max(dt, 1e-3));
    this.prevBucket.copy(center);
    const mouth = this.mouth();
    const canFill = mouth.y > -0.3;
    const push = new THREE.Vector3(this.bucketVel.x, 0, this.bucketVel.z);
    if (push.lengthSq() < 0.01) push.set(0, 1, 0).transformDirection(this.bucket.matrixWorld).setY(0);
    push.normalize().multiplyScalar(0.45);

    let moved = 0;
    for (const p of this.bucketPoints()) {
      if (!this.sand.inside(p.x, p.z)) continue;
      if (this.sand.heightAt(p.x, p.z) <= p.y) continue;
      if (canFill && this.fill < BUCKET_CAP) {
        const v = this.sand.carve(p.x, p.z, 0.11, p.y, BUCKET_CAP - this.fill);
        this.fill += v;
        moved += v;
      } else {
        const v = this.sand.carve(p.x, p.z, 0.11, p.y);
        if (v > 0) this.sand.deposit(p.x + push.x, p.z + push.z, v, 0.22);
        moved += v;
      }
    }
    this.dig = this.dig * 0.8 + moved * 0.2;

    // Helle ut
    this.pour = 0;
    if (mouth.y < -0.35 && this.fill > 1e-4) {
      const k = Math.min(1, (-mouth.y - 0.35) / 0.5);
      const amt = Math.min(this.fill, BUCKET_CAP * 1.6 * k * dt);
      this.fill -= amt;
      this.pour = amt / dt;
      const n = Math.max(1, Math.min(8, Math.round(amt / 0.0025)));
      const m = this.bucket.matrixWorld;
      for (let i = 0; i < n; i++) {
        const p = new THREE.Vector3(L3 * (0.15 + Math.random() * 0.8), -0.03, (Math.random() - 0.5) * W * 0.8).applyMatrix4(m);
        const v = mouth.clone().multiplyScalar(0.6).addScaledVector(this.bucketVel, 0.6);
        v.x += (Math.random() - 0.5) * 0.3; v.z += (Math.random() - 0.5) * 0.3;
        this.grains.spawn(p, v, amt / n);
      }
    }
  }

  updateLoad() {
    const f = this.fill / BUCKET_CAP;
    this.load.visible = f > 0.02;
    if (this.load.visible) {
      this.load.position.set(L3 * 0.48, D * 0.32, 0);
      this.load.scale.set(L3 * 0.42, D * (0.25 + 0.55 * Math.sqrt(f)), W * 0.44);
    }
  }

  updatePistons() {
    const up = this.upper;
    const toUp = (obj, x, y) => up.worldToLocal(obj.localToWorld(new THREE.Vector3(x, y, 0)));
    this.pistons[0].set(new THREE.Vector3(0.95, 0.4, 0.22), toUp(this.boom, L1 * 0.42, -0.16));
    this.pistons[1].set(toUp(this.boom, L1 * 0.5, 0.18), toUp(this.stick, -0.2, 0.1));
    this.pistons[2].set(toUp(this.stick, L2 * 0.3, 0.14), toUp(this.bucket, 0.02, 0.2));
  }

  toggleBucket() { this.dumping = !this.dumping; }

  castle() {
    if (this.fill < BUCKET_CAP * 0.5) return false;
    const c = new THREE.Vector3(L3 * 0.5, 0, 0).applyMatrix4(this.bucket.matrixWorld);
    if (!this.sand.inside(c.x, c.z, 0.7)) return false;
    if (!this.sand.stampTower(c.x, c.z, this.castleType)) return false;
    this.castleType = (this.castleType + 1) % 3;
    this.fill = 0;
    return true;
  }

  // Bytt styremodus uten at armen hopper
  syncMode() { this.setWristFromAngles(); }

  reset(x, z, yaw) {
    this.swing = 0; this.a1 = 0.35; this.s = -1.6; this.b = -1.4; this.fill = 0; this.dumping = false;
    this.place(x, z, yaw);
    this.poseArm();
    this.setWristFromAngles();
    this.prevBucket.set(0, 0, 0).applyMatrix4(this.bucket.matrixWorld);
  }
}
