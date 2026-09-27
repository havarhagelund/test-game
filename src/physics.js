import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { HALF, GRID, CELL, WALL_H, WALL_T, GRAVITY, COLORS } from './config.js';
import { plastic, rbox, cyl, sphere, shadowed } from './models.js';

const STEP = 1 / 60;

export async function createPhysics() {
  await RAPIER.init();
  return new Physics();
}

class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.acc = 0;
    this.toys = [];
    this.kin = [];
    this.terrain = null;
    this.terrainVersion = -1;
    this.terrainTimer = 0;
    this.heights = new Float32Array(GRID * GRID);

    const fixed = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    // Gress (stor plate under alt) og vegger
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0), fixed);
    const L = HALF + WALL_T;
    const walls = [[0, -HALF - WALL_T / 2, L, WALL_T / 2], [0, HALF + WALL_T / 2, L, WALL_T / 2], [-HALF - WALL_T / 2, 0, WALL_T / 2, HALF], [HALF + WALL_T / 2, 0, WALL_T / 2, HALF]];
    for (const [x, z, hx, hz] of walls) {
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, WALL_H / 2 + 0.05, hz).setTranslation(x, WALL_H / 2, z).setFriction(0.6), fixed);
    }
  }

  syncTerrain(sand, dt, force = false) {
    this.terrainTimer -= dt;
    if (!force && (sand.version === this.terrainVersion || this.terrainTimer > 0)) return;
    this.terrainTimer = 0.2;
    this.terrainVersion = sand.version;
    const N = GRID, H = this.heights, h = sand.h;
    // Rapier vil ha kolonne-major: indeks = ix * N + iz
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) H[ix * N + iz] = h[iz * N + ix];
    if (this.terrain) this.world.removeCollider(this.terrain, false);
    const size = (N - 1) * CELL;
    this.terrain = this.world.createCollider(
      RAPIER.ColliderDesc.heightfield(N - 1, N - 1, H, { x: size, y: 1, z: size }).setFriction(0.9)
    );
    for (const t of this.toys) t.body.wakeUp();
  }

  // Kinematiske kolliderere som følger kjøretøyene, så de kan dytte leker.
  addVehicle(v) {
    for (const a of v.anchors) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(...a.half).setFriction(0.8), body);
      this.kin.push({ body, obj: a.obj, teleport: true });
    }
  }

  addToy(mesh, colliderDescs, pos, mass = 1) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinearDamping(0.3).setAngularDamping(0.4).setCcdEnabled(true)
    );
    for (const d of colliderDescs) this.world.createCollider(d.setDensity(mass), body);
    this.toys.push({ body, mesh, start: pos.clone() });
  }

  step(dt) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    for (const k of this.kin) {
      k.obj.getWorldPosition(p);
      k.obj.getWorldQuaternion(q);
      if (k.teleport) { k.body.setTranslation(p, true); k.body.setRotation(q, true); k.teleport = false; }
      else { k.body.setNextKinematicTranslation(p); k.body.setNextKinematicRotation(q); }
    }
    this.acc = Math.min(this.acc + dt, STEP * 4);
    while (this.acc >= STEP) {
      this.world.timestep = STEP;
      this.world.step();
      this.acc -= STEP;
    }
    for (const t of this.toys) {
      const tr = t.body.translation();
      if (tr.y < -3 || Math.abs(tr.x) > 40 || Math.abs(tr.z) > 40) this.respawn(t);
      t.mesh.position.copy(t.body.translation());
      t.mesh.quaternion.copy(t.body.rotation());
    }
  }

  respawn(t) {
    t.body.setTranslation(t.start, true);
    t.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    t.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    t.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  }

  resetAll() {
    for (const t of this.toys) this.respawn(t);
    for (const k of this.kin) k.teleport = true;
  }
}

// Leker i sandkassa
export function spawnToys(physics, scene, sand) {
  const C = RAPIER.ColliderDesc;
  const at = (x, z, lift = 0.6) => new THREE.Vector3(x, sand.heightAt(x, z) + lift, z);
  const add = (mesh, descs, pos, mass) => { scene.add(mesh); physics.addToy(mesh, descs, pos, mass); };

  // Baller
  [[0.38, COLORS.pink, -4.5, 3.5], [0.3, COLORS.blue, 5, -4.8], [0.45, COLORS.yellow, 4.6, 4.2]].forEach(([r, c, x, z]) => {
    const g = new THREE.Group();
    const ball = sphere(r, plastic(c, { roughness: 0.3 }), 28);
    g.add(ball);
    const stripe = shadowed(new THREE.Mesh(new THREE.TorusGeometry(r * 0.995, r * 0.12, 8, 32), plastic(0xffffff, { roughness: 0.3 })));
    g.add(stripe);
    add(g, [C.ball(r).setRestitution(0.55).setFriction(0.7)], at(x, z), 0.35);
  });

  // Klosser
  const cols = [COLORS.mint, COLORS.lavender, COLORS.peach, COLORS.pink, COLORS.blue, COLORS.yellow];
  cols.forEach((c, k) => {
    const s = 0.42;
    const m = rbox(s, s, s, 0.07, plastic(c));
    const x = -5.5 + (k % 3) * 0.55, z = -5 + Math.floor(k / 3) * 0.6;
    add(m, [C.cuboid(s / 2, s / 2, s / 2).setFriction(0.8)], at(x, z, 0.4 + Math.floor(k / 3) * 0.5), 0.6);
  });

  // Sandbøtte
  {
    const g = new THREE.Group();
    const mat = plastic(COLORS.blue, { side: THREE.DoubleSide });
    const wall = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.55, 24, 1, true), mat));
    g.add(wall);
    const bottom = cyl(0.26, 0.26, 0.04, mat);
    bottom.position.y = -0.26;
    g.add(bottom);
    const rim = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 24), plastic(COLORS.pink)));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.27;
    g.add(rim);
    const handle = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.02, 6, 24, Math.PI), plastic(COLORS.yellow)));
    handle.position.y = 0.27;
    g.add(handle);
    add(g, [C.cylinder(0.275, 0.3).setFriction(0.8)], at(-3, -1.5), 0.3);
  }

  // Spade
  {
    const g = new THREE.Group();
    const handle = cyl(0.04, 0.04, 0.9, plastic(COLORS.yellow), 10);
    handle.rotation.z = Math.PI / 2;
    handle.position.x = -0.25;
    g.add(handle);
    const grip = rbox(0.08, 0.08, 0.3, 0.03, plastic(COLORS.yellow));
    grip.position.x = -0.7;
    g.add(grip);
    const blade = rbox(0.4, 0.05, 0.34, 0.03, plastic(COLORS.pink));
    blade.position.x = 0.35;
    g.add(blade);
    add(g, [C.cuboid(0.45, 0.03, 0.05).setTranslation(-0.25, 0, 0), C.cuboid(0.2, 0.03, 0.17).setTranslation(0.35, 0, 0), C.cuboid(0.04, 0.04, 0.15).setTranslation(-0.7, 0, 0)], at(2.5, 5.5), 0.5);
  }

  // Badeand
  {
    const g = new THREE.Group();
    const y = plastic(0xffe27a, { roughness: 0.3 });
    const body = sphere(0.3, y);
    body.scale.set(1.2, 0.85, 1);
    g.add(body);
    const head = sphere(0.18, y);
    head.position.set(0.2, 0.28, 0);
    g.add(head);
    const beak = sphere(0.08, plastic(0xffa77a));
    beak.scale.set(1.4, 0.5, 1);
    beak.position.set(0.38, 0.26, 0);
    g.add(beak);
    for (const z of [-0.08, 0.08]) {
      const eye = sphere(0.025, plastic(0x4b4766), 8);
      eye.position.set(0.33, 0.34, z);
      g.add(eye);
    }
    add(g, [C.ball(0.28).setRestitution(0.3), C.ball(0.17).setTranslation(0.2, 0.28, 0)], at(-1, 5.8), 0.25);
  }
}
