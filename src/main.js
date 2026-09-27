import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Sand } from './sand.js';
import { Grains } from './grains.js';
import { Excavator, BUCKET_CAP } from './excavator.js';
import { Truck, BED_CAP } from './truck.js';
import { createPhysics, spawnToys } from './physics.js';
import { Controls } from './controls.js';
import { FollowCam } from './camera.js';
import { Sound } from './audio.js';

const lowPower = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 250);
buildWorld(scene, lowPower);

const sand = new Sand();
scene.add(sand.mesh);
const grains = new Grains(sand);
scene.add(grains.mesh);

const excavator = new Excavator(sand, grains);
const truck = new Truck(sand, grains);
excavator.others = [truck];
truck.others = [excavator];
scene.add(excavator.root, truck.root);
grains.catchers.push(truck);

const START = { ex: [-2, 1.5, 0.2], tr: [3.2, -2.5, Math.PI * 0.55] };
excavator.reset(...START.ex);
truck.reset(...START.tr);

const state = { active: excavator, expert: false, started: false };
const sound = new Sound();
const follow = new FollowCam(camera, canvas);
const $ = (id) => document.getElementById(id);

let physics = null;
createPhysics().then((p) => {
  physics = p;
  p.syncTerrain(sand, 0, true);
  p.addVehicle(excavator);
  p.addVehicle(truck);
  spawnToys(p, scene, sand);
  $('loading').textContent = '';
  $('go').disabled = false;
});
$('go').disabled = true;

// --- UI ---
const controls = new Controls($('controls'), {
  primary() {
    sound.blip([520, 700], 0.07, 'triangle', 0.12);
    if (state.active === excavator) excavator.toggleBucket();
    else truck.toggleTip();
  },
  castle() {
    if (excavator.castle()) {
      sound.blip([523, 659, 784, 1046], 0.1, 'sine', 0.16);
      toast('🏰 Slott!');
    } else {
      sound.blip([300], 0.1, 'triangle', 0.1);
      toast('Fyll skuffen med sand først, og hold den over sandkassa');
    }
  },
  switchVehicle,
  toggleMode,
});

function switchVehicle() {
  state.active = state.active === excavator ? truck : excavator;
  sound.blip([440, 587], 0.08, 'triangle', 0.12);
  refreshUI();
}

function toggleMode() {
  state.expert = !state.expert;
  excavator.syncMode();
  sound.blip([392, 494], 0.08, 'triangle', 0.12);
  toast(state.expert ? 'Ekspert: venstre spak = stikke/sving, høyre = bom/skuff, midten = belter' : 'Enkel styring');
  refreshUI();
}

function refreshUI() {
  const ex = state.active === excavator;
  $('switch').innerHTML = ex ? '🚚<span class="lbl"> Dumper</span>' : '🚜<span class="lbl"> Graver</span>';
  $('mode').innerHTML = state.expert ? '🎛<span class="lbl"> Ekspert</span>' : '🙂<span class="lbl"> Enkel</span>';
  $('mode').classList.toggle('expert', state.expert);
  $('meter-icon').textContent = ex ? '🪣' : '🚚';
  controls.layout(state.active.kind, state.expert);
}

$('switch').addEventListener('click', switchVehicle);
$('mode').addEventListener('click', toggleMode);
$('sound').addEventListener('click', () => {
  sound.setMuted(!sound.muted);
  $('sound').textContent = sound.muted ? '🔇' : '🔊';
});
$('full').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await document.documentElement.requestFullscreen();
      await screen.orientation?.lock?.('landscape');
    }
  } catch { /* ikke støttet */ }
});
$('help').addEventListener('click', () => { $('start').classList.remove('hidden'); $('go').textContent = 'Fortsett'; });

const RESET_HTML = $('reset').innerHTML;
let resetArmed = 0;
$('reset').addEventListener('click', () => {
  const now = performance.now();
  if (now - resetArmed > 2500) {
    resetArmed = now;
    $('reset').classList.add('warn');
    $('reset').textContent = 'Sikker?';
    setTimeout(() => { $('reset').classList.remove('warn'); $('reset').innerHTML = RESET_HTML; }, 2500);
    return;
  }
  resetArmed = 0;
  $('reset').classList.remove('warn');
  $('reset').innerHTML = RESET_HTML;
  sand.reset();
  grains.clear();
  excavator.reset(...START.ex);
  truck.reset(...START.tr);
  physics?.syncTerrain(sand, 0, true);
  physics?.resetAll();
  follow.update(0, state.active, sand, true);
  sound.blip([784, 659, 523], 0.09, 'sine', 0.14);
});

$('go').addEventListener('click', () => {
  sound.start();
  $('start').classList.add('hidden');
  state.started = true;
});

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 62 : 50;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
refreshUI();
follow.update(0, state.active, sand, true);

// --- Løkke ---
const idle = { lx: 0, ly: 0, rx: 0, ry: 0, reach: 0, trackL: 0, trackR: 0 };
let last = performance.now();
function tick(dt, inp) {
  for (const v of [excavator, truck]) v.update(dt, v === state.active ? inp : idle, state.expert);
  grains.update(dt);
  sand.step(lowPower ? 18000 : 30000);
  if (physics) {
    physics.syncTerrain(sand, dt);
    physics.step(dt);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const inp = state.started ? controls.read(state.active.kind, state.expert) : idle;
  tick(dt, inp);
  sand.updateMesh();
  follow.update(dt, state.active, sand);

  // HUD
  const ex = state.active === excavator;
  const f = ex ? excavator.fill / BUCKET_CAP : truck.payload / BED_CAP;
  $('meter-fill').style.width = `${Math.round(Math.min(1, f) * 100)}%`;
  if (ex) {
    controls.setPrimaryLabel(excavator.dumping ? '<span>🪣</span><small>Grav</small>' : '<span>🪣</span><small>Tøm</small>');
    controls.buttons.primary?.classList.toggle('on', excavator.dumping);
    controls.setCastleEnabled(excavator.fill >= BUCKET_CAP * 0.5);
  } else {
    controls.setPrimaryLabel(truck.tipping ? '<span>⤵</span><small>Senk</small>' : '<span>⤴</span><small>Tipp</small>');
    controls.buttons.primary?.classList.toggle('on', truck.tipping);
  }

  const a = state.active;
  sound.update({
    kind: a.kind,
    throttle: Math.min(1, Math.abs(a.speed) / 2),
    arm: ex ? Math.min(1, excavator.armMotion * 0.6) : Math.abs(inp.ry),
    dig: ex ? excavator.dig : 0,
    pour: (excavator.pour + truck.pour) * 2 + grains.landed * 0.01,
  });

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// for feilsøking i konsollen
Object.assign(window, { sand, excavator, truck, state, scene, renderer, grains, follow, getPhysics: () => physics });
// simuler uten rendering: sim(sekunder, { ly: 1 })
window.sim = (sec, inp = {}) => {
  const t0 = performance.now();
  for (let k = 0; k < sec * 60; k++) tick(1 / 60, { ...idle, ...inp });
  return performance.now() - t0;
};
