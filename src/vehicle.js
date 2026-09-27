import * as THREE from 'three';
import { HALF, GRAVITY } from './config.js';

const MAX_SLOPE = 0.72; // ~41°

// Felles bevegelse for kjøretøy som følger sandoverflaten.
export class Vehicle {
  constructor(sand, { length, width, radius }) {
    this.sand = sand;
    this.length = length;
    this.width = width;
    this.radius = radius;
    this.root = new THREE.Group();
    this.root.rotation.order = 'YZX';
    this.x = 0; this.z = 0; this.yaw = 0;
    this.y = 1; this.vy = 0; this.pitch = 0; this.roll = 0;
    this.speed = 0;
    this.others = [];
  }

  place(x, z, yaw) {
    this.x = x; this.z = z; this.yaw = yaw; this.speed = 0;
    const s = this.sample(x, z, yaw);
    this.y = s.y; this.vy = 0; this.pitch = s.pitch; this.roll = s.roll;
    this.apply();
  }

  forward() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  sample(x, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hl = this.length * 0.42, hw = this.width * 0.42;
    const at = (f, r) => this.sand.supportAt(x + c * f + s * r, z - s * f + c * r, 0.14);
    const fl = at(hl, -hw), fr = at(hl, hw), rl = at(-hl, -hw), rr = at(-hl, hw);
    const front = (fl + fr) / 2, rear = (rl + rr) / 2, left = (fl + rl) / 2, right = (fr + rr) / 2;
    return {
      y: Math.max((front + rear) / 2, at(0, 0) - 0.05),
      pitch: Math.atan2(front - rear, hl * 2),
      roll: Math.atan2(left - right, hw * 2),
    };
  }

  blockedBy(x, z, yaw = this.yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw), hl = this.length / 2 + 0.05, hw = this.width / 2 + 0.05;
    for (const [f, r] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) {
      const px = x + c * f + s * r, pz = z - s * f + c * r;
      const d = Math.max(Math.abs(px), Math.abs(pz));
      // et hjørne som allerede er utenfor får lov å bevege seg innover
      if (d > HALF - 0.08 && d >= this.cornerDist(f, r) - 1e-6) return true;
    }
    for (const o of this.others) {
      if (Math.hypot(o.x - x, o.z - z) < this.radius + o.radius) {
        // tillat å kjøre bort fra den andre
        if (Math.hypot(o.x - x, o.z - z) < Math.hypot(o.x - this.x, o.z - this.z)) return true;
      }
    }
    return false;
  }

  cornerDist(f, r) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return Math.max(Math.abs(this.x + c * f + s * r), Math.abs(this.z - s * f + c * r));
  }

  // throttle: ønsket fart, yawRate: rad/s
  drive(dt, targetSpeed, yawRate, accel) {
    const ds = targetSpeed - this.speed;
    this.speed += Math.sign(ds) * Math.min(Math.abs(ds), accel * dt);
    // oppoverbakke gjør det tyngre
    const climb = this.pitch * Math.sign(this.speed || 1);
    const eff = this.speed * (1 - Math.min(0.75, Math.max(0, climb) * 0.9));

    const yaw = this.yaw + yawRate * dt;
    const nx = this.x + Math.cos(yaw) * eff * dt;
    const nz = this.z - Math.sin(yaw) * eff * dt;
    const s = this.sample(nx, nz, yaw);
    const tooSteep = Math.abs(s.pitch) > MAX_SLOPE && Math.abs(s.pitch) > Math.abs(this.pitch) + 1e-4;
    const tooRoll = Math.abs(s.roll) > MAX_SLOPE && Math.abs(s.roll) > Math.abs(this.roll) + 1e-4;
    if (!tooSteep && !tooRoll && !this.blockedBy(nx, nz, yaw)) {
      this.x = nx; this.z = nz; this.yaw = yaw;
    } else {
      this.speed *= 0.3;
      // prøv bare å snu på stedet
      const s2 = this.sample(this.x, this.z, yaw);
      if (Math.abs(s2.roll) <= MAX_SLOPE && !this.blockedBy(this.x, this.z, yaw)) this.yaw = yaw;
    }
    this.settle(dt);
  }

  settle(dt) {
    const s = this.sample(this.x, this.z, this.yaw);
    if (s.y >= this.y) {
      this.y += (s.y - this.y) * Math.min(1, dt * 18);
      this.vy = 0;
    } else {
      this.vy -= GRAVITY * dt;
      this.y = Math.max(s.y, this.y + this.vy * dt);
      if (this.y === s.y) this.vy = 0;
    }
    const k = Math.min(1, dt * 10);
    this.pitch += (s.pitch - this.pitch) * k;
    this.roll += (s.roll - this.roll) * k;
    this.apply();
  }

  apply() {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.set(this.roll, this.yaw, this.pitch);
    this.root.updateMatrixWorld(true);
  }
}
