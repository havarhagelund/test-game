import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const matCache = new Map();

// Myk leketøysplast.
export function plastic(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0, ...opts }));
  }
  return matCache.get(key);
}

export function matte(color) {
  return plastic(color, { roughness: 0.9 });
}

export function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function rbox(w, h, d, r, mat) {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  return shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, rr), mat));
}

export function cyl(rt, rb, h, mat, seg = 24) {
  return shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat));
}

export function sphere(r, mat, seg = 24) {
  return shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat));
}

// Et hjul liggende langs z-aksen (ruller om z).
export function wheel(r, w, tireMat, hubMat) {
  const g = new THREE.Group();
  const tire = shadowed(new THREE.Mesh(new THREE.TorusGeometry(r * 0.72, r * 0.3, 12, 24), tireMat));
  tire.scale.z = w / (r * 0.6);
  g.add(tire);
  const hub = cyl(r * 0.5, r * 0.5, w * 0.8, hubMat, 18);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  const cap = sphere(r * 0.18, tireMat, 12);
  cap.position.z = w * 0.42;
  g.add(cap);
  const cap2 = cap.clone();
  cap2.position.z = -w * 0.42;
  g.add(cap2);
  return g;
}

// Stempel/hydraulikksylinder mellom to punkter i samme forelder-rom.
export class Piston {
  constructor(parent, r, matBody, matRod) {
    this.body = cyl(r, r, 1, matBody, 12);
    this.rod = cyl(r * 0.55, r * 0.55, 1, matRod, 10);
    parent.add(this.body, this.rod);
  }
  set(a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const bl = len * 0.55;
    this.body.quaternion.copy(q);
    this.body.scale.set(1, bl, 1);
    this.body.position.copy(a).addScaledVector(dir, bl / 2);
    this.rod.quaternion.copy(q);
    this.rod.scale.set(1, len - bl * 0.5, 1);
    this.rod.position.copy(b).addScaledVector(dir, -(len - bl * 0.5) / 2);
  }
}
