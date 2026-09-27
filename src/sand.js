import * as THREE from 'three';
import { HALF, GRID, CELL, REPOSE, SAND_START, COLORS } from './config.js';

const N = GRID;
const SURFACE_OFFSET = 0.015; // sanda tegnes litt under reell høyde så plankene synes når den er tom

// Høydekart-sand. Bunnen (plankene) er y = 0, så h er både høyde og sandmengde.
export class Sand {
  constructor() {
    this.h = new Float32Array(N * N);
    this.packed = new Uint8Array(N * N); // slott-sand holder formen og raser ikke
    this.active = new Uint8Array(N * N);
    this.activeList = [];
    this.tint = new Float32Array(N * N);
    this.version = 0;
    this.dirty = null;
    this.buildMesh();
    this.reset();
  }

  reset() {
    const { h } = this;
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const x = ix * CELL, z = iz * CELL;
        const n =
          Math.sin(x * 0.9 + 1.3) * Math.cos(z * 0.7) * 0.06 +
          Math.sin(x * 2.1 - z * 1.7) * 0.025 +
          Math.cos(z * 2.9 + x * 0.3) * 0.02;
        h[iz * N + ix] = SAND_START + n;
        this.tint[iz * N + ix] = (Math.random() - 0.5) * 0.018;
      }
    }
    this.packed.fill(0);
    this.active.fill(0);
    this.activeList = [];
    this.markDirty(0, 0, N - 1, N - 1);
    this.version++;
  }

  idx(ix, iz) { return iz * N + ix; }
  toCell(v) { return (v + HALF) / CELL - 0.5; }
  cellCenter(i) { return -HALF + (i + 0.5) * CELL; }
  inside(x, z, m = 0) { return x > -HALF + m && x < HALF - m && z > -HALF + m && z < HALF - m; }

  heightAt(x, z) {
    let fx = this.toCell(x), fz = this.toCell(z);
    fx = Math.min(Math.max(fx, 0), N - 1.001);
    fz = Math.min(Math.max(fz, 0), N - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const h = this.h, i = iz * N + ix;
    const a = h[i] + (h[i + 1] - h[i]) * tx;
    const b = h[i + N] + (h[i + N + 1] - h[i + N]) * tx;
    return a + (b - a) * tz;
  }

  // Høyeste punkt i en liten radius, så beltene bygger bro over små hull.
  supportAt(x, z, r = 0.12) {
    return Math.max(this.heightAt(x, z), this.heightAt(x + r, z), this.heightAt(x - r, z), this.heightAt(x, z + r), this.heightAt(x, z - r));
  }

  markDirty(x0, z0, x1, z1) {
    x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(N - 1, x1); z1 = Math.min(N - 1, z1);
    const d = this.dirty;
    if (!d) this.dirty = { x0, z0, x1, z1 };
    else { d.x0 = Math.min(d.x0, x0); d.z0 = Math.min(d.z0, z0); d.x1 = Math.max(d.x1, x1); d.z1 = Math.max(d.z1, z1); }
  }

  activate(i) {
    if (!this.active[i]) { this.active[i] = 1; this.activeList.push(i); }
  }

  activateAround(ix, iz, r = 1) {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x = ix + dx, z = iz + dz;
      if (x >= 0 && z >= 0 && x < N && z < N) this.activate(z * N + x);
    }
  }

  forCells(x, z, r, fn) {
    const cx = this.toCell(x), cz = this.toCell(z), rc = r / CELL;
    const x0 = Math.max(0, Math.ceil(cx - rc)), x1 = Math.min(N - 1, Math.floor(cx + rc));
    const z0 = Math.max(0, Math.ceil(cz - rc)), z1 = Math.min(N - 1, Math.floor(cz + rc));
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      const dx = ix - cx, dz = iz - cz;
      const d2 = (dx * dx + dz * dz) / (rc * rc);
      if (d2 <= 1) fn(iz * N + ix, ix, iz, d2);
    }
  }

  // Skjær bort sand over yCut innen radius r. Returnerer fjernet volum (maks maxVol).
  carve(x, z, r, yCut, maxVol = Infinity) {
    yCut = Math.max(0, yCut);
    let vol = 0;
    const area = CELL * CELL;
    this.forCells(x, z, r, (i, ix, iz) => {
      const h = this.h[i];
      if (h <= yCut + 1e-4) return;
      let take = h - yCut;
      if (maxVol !== Infinity) take = Math.min(take, (maxVol - vol) / area);
      if (take <= 0) return;
      this.h[i] = h - take;
      vol += take * area;
      if (this.packed[i]) { this.packed[i] = 0; this.activateAround(ix, iz, 3); }
      this.activateAround(ix, iz, 1);
      this.markDirty(ix - 1, iz - 1, ix + 1, iz + 1);
    });
    if (vol > 0) this.version++;
    return vol;
  }

  // Legg volum vol ut som en myk haug rundt (x,z).
  deposit(x, z, vol, r = 0.18) {
    if (!this.inside(x, z)) return;
    const cells = [];
    let wsum = 0;
    this.forCells(x, z, Math.max(r, CELL * 0.8), (i, ix, iz, d2) => {
      const w = 1 - d2 * 0.8;
      cells.push(i, ix, iz, w);
      wsum += w;
    });
    if (!wsum) return;
    const dh = vol / (CELL * CELL) / wsum;
    for (let k = 0; k < cells.length; k += 4) {
      const i = cells[k];
      this.h[i] += dh * cells[k + 3];
      this.activateAround(cells[k + 1], cells[k + 2], 1);
      this.markDirty(cells[k + 1] - 1, cells[k + 2] - 1, cells[k + 1] + 1, cells[k + 2] + 1);
    }
    this.version++;
  }

  // Stemple et sandslott-tårn. type: 0 rundt, 1 firkant, 2 spir
  stampTower(x, z, type) {
    let base = Infinity;
    this.forCells(x, z, 0.6, (i) => { base = Math.min(base, this.h[i]); });
    if (base === Infinity) return false;
    base = Math.max(base, this.heightAt(x, z) - 0.15);
    const R = 0.62, H = 0.85;
    this.forCells(x, z, R * 1.42, (i, ix, iz) => {
      const dx = this.cellCenter(ix) - x, dz = this.cellCenter(iz) - z;
      const r = type === 1 ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.hypot(dx, dz);
      if (r > R) return;
      let top;
      if (type === 2) {
        top = base + H * 0.55 + (1 - r / R) * H * 0.9;
      } else {
        top = base + H;
        if (r > R * 0.62) {
          const ang = Math.atan2(dz, dx);
          const merlon = Math.cos(ang * (type === 1 ? 4 : 8)) > 0;
          top += merlon ? 0.18 : 0.02;
        } else top -= 0.06;
      }
      if (top > this.h[i]) this.h[i] = top;
      this.packed[i] = 1;
      this.markDirty(ix - 1, iz - 1, ix + 1, iz + 1);
    });
    this.version++;
    return true;
  }

  // Skred: flytt sand fra bratte skråninger til naboer til rasvinkelen er nådd.
  step(budget = 30000) {
    const { h, packed, active } = this;
    const lim = REPOSE * CELL, limD = REPOSE * CELL * Math.SQRT2;
    const list = this.activeList;
    this.activeList = [];
    const count = Math.min(list.length, budget);
    for (let k = 0; k < list.length; k++) active[list[k]] = 0;
    for (let k = count; k < list.length; k++) this.activate(list[k]);
    let moved = false;
    for (let k = 0; k < count; k++) {
      const i = list[k];
      if (packed[i]) continue;
      const ix = i % N, iz = (i / N) | 0;
      let hi = h[i];
      let changed = false;
      for (let dz = -1; dz <= 1; dz++) {
        const z = iz + dz;
        if (z < 0 || z >= N) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const x = ix + dx;
          if (x < 0 || x >= N) continue;
          const j = z * N + x;
          const diff = hi - h[j];
          const m = dx && dz ? limD : lim;
          if (diff > m) {
            const amt = (diff - m) * 0.22;
            hi -= amt;
            h[j] += amt;
            this.activate(j);
            changed = true;
          }
        }
      }
      if (changed) {
        h[i] = hi;
        // cella ble lavere: naboene kan nå være for bratte mot den
        this.activateAround(ix, iz, 1);
        this.markDirty(ix - 1, iz - 1, ix + 1, iz + 1);
        moved = true;
      }
    }
    if (moved) this.version++;
  }

  buildMesh() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * N * 3);
    const nor = new Float32Array(N * N * 3);
    const col = new Float32Array(N * N * 3);
    const uv = new Float32Array(N * N * 2);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const i = iz * N + ix;
      // kantpunktene strekkes helt ut til veggene
      pos[i * 3] = ix === 0 ? -HALF : ix === N - 1 ? HALF : this.cellCenter(ix);
      pos[i * 3 + 2] = iz === 0 ? -HALF : iz === N - 1 ? HALF : this.cellCenter(iz);
      nor[i * 3 + 1] = 1;
      uv[i * 2] = ix / 12; uv[i * 2 + 1] = iz / 12;
    }
    const idx = new Uint32Array((N - 1) * (N - 1) * 6);
    let k = 0;
    for (let iz = 0; iz < N - 1; iz++) for (let ix = 0; ix < N - 1; ix++) {
      const a = iz * N + ix, b = a + 1, c = a + N, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b;
      idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), HALF * 1.5);
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(-HALF, 0, -HALF), new THREE.Vector3(HALF, 6, HALF));

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: grainTexture() });
    // Triplanar kornstruktur så bratte vegger (slott, hull) ikke får strekte striper
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNor;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNor = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNor;')
        .replace('#include <map_fragment>', `
          vec3 bw = pow(abs(normalize(vWNor)), vec3(4.0));
          bw /= (bw.x + bw.y + bw.z);
          vec4 sampledDiffuseColor = texture2D(map, vWPos.zy * 0.83) * bw.x + texture2D(map, vWPos.xz * 0.83) * bw.y + texture2D(map, vWPos.xy * 0.83) * bw.z;
          diffuseColor *= sampledDiffuseColor;`);
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.geo = geo;
  }

  updateMesh() {
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    const { h, packed, tint } = this;
    const pos = this.geo.attributes.position, nor = this.geo.attributes.normal, col = this.geo.attributes.color;
    const P = pos.array, Nn = nor.array, C = col.array;
    const base = new THREE.Color(COLORS.sand), pk = new THREE.Color(COLORS.sandPacked), deep = new THREE.Color(0xeec48e);
    const inv = 1 / (2 * CELL);
    for (let iz = d.z0; iz <= d.z1; iz++) {
      for (let ix = d.x0; ix <= d.x1; ix++) {
        const i = iz * N + ix;
        const hi = h[i];
        P[i * 3 + 1] = hi - SURFACE_OFFSET;
        const hl = h[iz * N + Math.max(ix - 1, 0)], hr = h[iz * N + Math.min(ix + 1, N - 1)];
        const hd = h[Math.max(iz - 1, 0) * N + ix], hu = h[Math.min(iz + 1, N - 1) * N + ix];
        let nx = (hl - hr) * inv, nz = (hd - hu) * inv, ny = 1;
        const l = Math.hypot(nx, ny, nz);
        Nn[i * 3] = nx / l; Nn[i * 3 + 1] = ny / l; Nn[i * 3 + 2] = nz / l;
        // dypere sand blir litt mørkere/fuktigere
        const depthT = Math.min(1, Math.max(0, (0.6 - hi) / 0.6)) * 0.5;
        const c = packed[i] ? pk : base;
        const t = tint[i];
        C[i * 3] = (c.r + (deep.r - c.r) * depthT) + t;
        C[i * 3 + 1] = (c.g + (deep.g - c.g) * depthT) + t;
        C[i * 3 + 2] = (c.b + (deep.b - c.b) * depthT) + t * 0.6;
      }
    }
    const start = d.z0 * N, count = (d.z1 - d.z0 + 1) * N;
    for (const a of [pos, nor, col]) {
      a.clearUpdateRanges();
      a.addUpdateRange(start * a.itemSize, count * a.itemSize);
      a.needsUpdate = true;
    }
  }
}

function grainTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, s, s);
  for (let k = 0; k < 2600; k++) {
    const v = 225 + Math.random() * 30;
    g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
