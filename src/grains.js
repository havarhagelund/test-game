import * as THREE from 'three';
import { COLORS, GRAVITY, HALF } from './config.js';

const MAX = 1800;

// Sandklumper i lufta (når skuffen eller lasteplanet tømmes).
export class Grains {
  constructor(sand) {
    this.sand = sand;
    this.catchers = [];
    this.p = new Float32Array(MAX * 3);
    this.v = new Float32Array(MAX * 3);
    this.vol = new Float32Array(MAX);
    this.n = 0;
    this.landed = 0;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 1, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  spawn(pos, vel, vol) {
    let i = this.n;
    if (i >= MAX) { // fullt: legg sanda rett ned
      this.sand.deposit(pos.x, pos.z, vol);
      return;
    }
    this.n++;
    this.p[i * 3] = pos.x; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z;
    this.v[i * 3] = vel.x; this.v[i * 3 + 1] = vel.y; this.v[i * 3 + 2] = vel.z;
    this.vol[i] = vol;
  }

  remove(i) {
    const j = --this.n;
    if (i !== j) {
      for (let k = 0; k < 3; k++) { this.p[i * 3 + k] = this.p[j * 3 + k]; this.v[i * 3 + k] = this.v[j * 3 + k]; }
      this.vol[i] = this.vol[j];
    }
  }

  update(dt) {
    const tmp = new THREE.Vector3();
    this.landed = 0;
    for (let i = this.n - 1; i >= 0; i--) {
      const P = this.p, V = this.v;
      V[i * 3 + 1] -= GRAVITY * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      tmp.set(x, y, z);
      let caught = false;
      for (const c of this.catchers) {
        if (c.catches(tmp)) { c.addPayload(this.vol[i]); caught = true; break; }
      }
      if (caught) { this.remove(i); this.landed++; continue; }
      if (this.sand.inside(x, z)) {
        if (y <= this.sand.heightAt(x, z)) {
          this.sand.deposit(x, z, this.vol[i], 0.14);
          this.remove(i);
          this.landed++;
        }
      } else if (y <= 0 || Math.abs(x) > HALF + 30) {
        this.remove(i); // havnet i gresset
      }
    }
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.n; i++) {
      const s = Math.cbrt(this.vol[i]) * 0.55 + 0.03;
      m.makeScale(s, s, s);
      m.setPosition(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() { this.n = 0; this.mesh.count = 0; }
}
