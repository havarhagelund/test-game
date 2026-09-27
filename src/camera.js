import * as THREE from 'three';

// Tredjepersonskamera som følger aktivt kjøretøy. Dra for å rotere, knip/scroll for zoom.
export class FollowCam {
  constructor(camera, dom) {
    this.cam = camera;
    this.offsetYaw = 0.5;
    this.pitch = 0.5;
    this.dist = 9;
    this.target = new THREE.Vector3(0, 1, 0);
    this.yaw = 0;
    this.lastDrag = -10;
    this.pointers = new Map();
    this.pinch = 0;

    dom.addEventListener('pointerdown', (e) => {
      dom.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) this.pinch = this.pinchDist();
    });
    dom.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 1) {
        this.offsetYaw -= (e.clientX - p.x) * 0.006;
        this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - p.y) * 0.004, 0.15, 1.35);
        this.lastDrag = performance.now() / 1000;
      }
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2) {
        const d = this.pinchDist();
        if (this.pinch) this.dist = THREE.MathUtils.clamp(this.dist * (this.pinch / d), 4, 22);
        this.pinch = d;
      }
    });
    const up = (e) => { this.pointers.delete(e.pointerId); this.pinch = 0; };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = THREE.MathUtils.clamp(this.dist * Math.exp(e.deltaY * 0.001), 4, 22);
    }, { passive: false });
  }

  pinchDist() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  update(dt, vehicle, sand, snap = false) {
    const t = new THREE.Vector3(vehicle.x, vehicle.y + 0.9, vehicle.z);
    this.target.lerp(t, snap ? 1 : Math.min(1, dt * 5));
    // følg kjøretøyets retning, men litt sløvt
    let d = vehicle.yaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += snap ? d : d * Math.min(1, dt * 1.8);
    const yaw = this.yaw + Math.PI + this.offsetYaw;
    const hd = Math.cos(this.pitch) * this.dist;
    const pos = new THREE.Vector3(
      this.target.x + Math.cos(yaw) * hd,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z - Math.sin(yaw) * hd
    );
    const inBox = Math.abs(pos.x) < 8 && Math.abs(pos.z) < 8;
    const floor = (inBox ? sand.heightAt(pos.x, pos.z) : 0) + 0.6;
    pos.y = Math.max(pos.y, floor);
    this.cam.position.copy(pos);
    this.cam.lookAt(this.target);
  }
}
