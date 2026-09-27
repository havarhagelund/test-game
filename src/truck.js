import * as THREE from 'three';
import { COLORS } from './config.js';
import { Vehicle } from './vehicle.js';
import { plastic, rbox, sphere, wheel, shadowed } from './models.js';

export const BED_CAP = 1.6;
const BED_LEN = 1.7, BED_W = 1.2, FLOOR = 0.08;
const MAX_TILT = 1.0;

export class Truck extends Vehicle {
  constructor(sand, grains) {
    super(sand, { length: 2.6, width: 1.35, radius: 1.25 });
    this.grains = grains;
    this.kind = 'truck';
    this.payload = 0;
    this.tilt = 0;
    this.tipping = false;
    this.steer = 0;
    this.pour = 0;
    this.anchors = [];
    this.build();
  }

  build() {
    const mint = plastic(COLORS.mint), pink = plastic(COLORS.pink), lav = plastic(COLORS.lavender);
    const dark = plastic(COLORS.lilacDark, { roughness: 0.75 }), cream = plastic(COLORS.cream);
    const glass = plastic(COLORS.glass, { roughness: 0.15, transparent: true, opacity: 0.85 });
    const r = this.root;

    this.wheels = [];
    this.steerPivots = [];
    for (const x of [0.85, -0.8]) for (const z of [-0.62, 0.62]) {
      const piv = new THREE.Group();
      piv.position.set(x, 0.34, z);
      const w = wheel(0.34, 0.26, dark, cream);
      piv.add(w);
      r.add(piv);
      this.wheels.push(w);
      if (x > 0) this.steerPivots.push(piv);
    }
    const chassis = rbox(2.5, 0.26, 1.0, 0.1, lav);
    chassis.position.y = 0.5;
    r.add(chassis);
    for (const z of [-0.62, 0.62]) for (const x of [0.85, -0.8]) {
      const fender = rbox(0.8, 0.12, 0.32, 0.06, mint);
      fender.position.set(x, 0.74, z);
      r.add(fender);
    }
    const cab = rbox(0.85, 0.8, 1.2, 0.2, mint);
    cab.position.set(0.8, 1.02, 0);
    r.add(cab);
    const win = rbox(0.5, 0.36, 1.24, 0.1, glass);
    win.position.set(0.95, 1.18, 0);
    r.add(win);
    const bumper = rbox(0.14, 0.18, 1.2, 0.07, cream);
    bumper.position.set(1.28, 0.55, 0);
    r.add(bumper);
    for (const z of [-0.4, 0.4]) {
      const l = sphere(0.08, plastic(0xffffff, { emissive: 0xfff3c0, emissiveIntensity: 0.5 }), 10);
      l.position.set(1.24, 0.82, z);
      r.add(l);
    }
    const head = sphere(0.14, plastic(COLORS.peach), 14);
    head.position.set(0.72, 1.2, 0.25);
    r.add(head);
    const cap = sphere(0.15, plastic(COLORS.yellow), 14);
    cap.scale.y = 0.6;
    cap.position.set(0.72, 1.28, 0.25);
    r.add(cap);
    this.anchor(r, [0.1, 0.62, 0], [1.25, 0.3, 0.62]);
    this.anchor(r, [0.8, 1.02, 0], [0.42, 0.4, 0.6]);

    // Lasteplan som vippes rundt bakakselen
    const bed = (this.bed = new THREE.Group());
    bed.position.set(-1.2, 0.66, 0);
    r.add(bed);
    const floor = rbox(BED_LEN, 0.1, BED_W, 0.04, pink);
    floor.position.set(BED_LEN / 2 + 0.05, FLOOR / 2, 0);
    bed.add(floor);
    for (const z of [-1, 1]) {
      const side = rbox(BED_LEN, 0.5, 0.1, 0.05, pink);
      side.position.set(BED_LEN / 2 + 0.05, 0.3, (z * (BED_W - 0.1)) / 2);
      bed.add(side);
      this.anchor(bed, [BED_LEN / 2 + 0.05, 0.3, (z * (BED_W - 0.1)) / 2], [BED_LEN / 2, 0.25, 0.05]);
    }
    const front = rbox(0.12, 0.7, BED_W, 0.05, pink);
    front.position.set(BED_LEN + 0.02, 0.38, 0);
    bed.add(front);
    const lip = rbox(0.1, 0.16, BED_W, 0.05, cream);
    lip.position.set(0.05, 0.12, 0);
    bed.add(lip);
    this.anchor(bed, [BED_LEN / 2 + 0.05, FLOOR / 2, 0], [BED_LEN / 2, 0.05, BED_W / 2]);
    this.anchor(bed, [BED_LEN + 0.02, 0.38, 0], [0.06, 0.35, BED_W / 2]);

    this.load = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), plastic(COLORS.sand, { roughness: 1 })));
    this.load.visible = false;
    bed.add(this.load);
  }

  anchor(parent, offset, half) {
    const o = new THREE.Object3D();
    o.position.set(...offset);
    parent.add(o);
    this.anchors.push({ obj: o, half });
  }

  update(dt, inp, expert) {
    const targetSteer = -inp.lx * 0.6;
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 8);
    const wantSpeed = inp.ly * 3.4;
    const yawRate = (this.speed * Math.tan(this.steer)) / 1.65;
    this.drive(dt, wantSpeed, yawRate, 3.5);
    for (const w of this.wheels) w.rotation.z -= (this.speed * dt) / 0.34;
    for (const p of this.steerPivots) p.rotation.y = this.steer;

    if (expert) this.tilt += inp.ry * 0.7 * dt;
    else {
      const t = this.tipping ? MAX_TILT : 0;
      this.tilt += Math.sign(t - this.tilt) * Math.min(Math.abs(t - this.tilt), 0.7 * dt);
    }
    this.tilt = Math.min(MAX_TILT, Math.max(0, this.tilt));
    this.bed.rotation.z = this.tilt;
    this.root.updateMatrixWorld(true);

    this.pour = 0;
    if (this.tilt > 0.3 && this.payload > 1e-4) {
      const k = (this.tilt - 0.3) / (MAX_TILT - 0.3);
      const amt = Math.min(this.payload, BED_CAP * 0.7 * k * dt);
      this.payload -= amt;
      this.pour = amt / dt;
      const n = Math.max(1, Math.min(10, Math.round(amt / 0.004)));
      const m = this.bed.matrixWorld;
      const back = this.forward().multiplyScalar(-0.9 - Math.abs(this.speed) * 0.3);
      for (let i = 0; i < n; i++) {
        const p = new THREE.Vector3(-0.05 - Math.random() * 0.08, FLOOR + 0.05 + Math.random() * 0.1, (Math.random() - 0.5) * (BED_W - 0.25)).applyMatrix4(m);
        const v = back.clone();
        v.y = -0.4;
        v.x += (Math.random() - 0.5) * 0.25; v.z += (Math.random() - 0.5) * 0.25;
        this.grains.spawn(p, v, amt / n);
      }
    }
    this.updateLoad();
  }

  loadHeight() { return 0.05 + 0.5 * Math.sqrt(this.payload / BED_CAP); }

  // Fanger et sandkorn som lander i lasteplanet
  catches(p) {
    if (this.tilt > 0.25 || this.payload >= BED_CAP) return false;
    const l = this.bed.worldToLocal(p.clone());
    return l.x > 0.1 && l.x < BED_LEN && Math.abs(l.z) < BED_W / 2 - 0.05 && l.y < FLOOR + this.loadHeight() + 0.05 && l.y > FLOOR - 0.4;
  }

  addPayload(v) { this.payload = Math.min(BED_CAP, this.payload + v); }

  updateLoad() {
    const f = this.payload / BED_CAP;
    this.load.visible = f > 0.01;
    if (this.load.visible) {
      this.load.position.set(BED_LEN / 2 + 0.1, FLOOR, 0);
      this.load.scale.set(BED_LEN * 0.46, this.loadHeight(), BED_W * 0.44);
    }
  }

  toggleTip() { this.tipping = !this.tipping; }

  reset(x, z, yaw) {
    this.payload = 0; this.tilt = 0; this.tipping = false; this.steer = 0;
    this.place(x, z, yaw);
  }
}
