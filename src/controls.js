// Touch-styring (joysticker, spaker, knapper) + tastatur som reserve.

class Stick {
  // axis: 'xy' for joystick, 'y' for spak som fjærer tilbake
  constructor(parent, cls, label, axis = 'xy') {
    this.axis = axis;
    this.x = 0; this.y = 0;
    this.el = document.createElement('div');
    this.el.className = `stick ${axis === 'y' ? 'lever' : ''} ${cls}`;
    this.knob = document.createElement('div');
    this.knob.className = 'knob';
    this.el.appendChild(this.knob);
    if (label) {
      const l = document.createElement('div');
      l.className = 'stick-label';
      l.textContent = label;
      this.el.appendChild(l);
    }
    parent.appendChild(this.el);
    this.id = null;
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.id !== null) return;
      this.id = e.pointerId;
      this.el.setPointerCapture(e.pointerId);
      this.move(e);
    });
    this.el.addEventListener('pointermove', (e) => { if (e.pointerId === this.id) this.move(e); });
    const end = (e) => {
      if (e.pointerId !== this.id) return;
      this.id = null;
      this.x = this.y = 0;
      this.knob.style.transform = '';
      this.el.classList.remove('on');
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }

  move(e) {
    const r = this.el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const rad = this.axis === 'y' ? r.height / 2 - r.width * 0.3 : r.width / 2 - 18;
    let dx = this.axis === 'y' ? 0 : (e.clientX - cx) / rad;
    let dy = (e.clientY - cy) / rad;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    this.x = dz(dx); this.y = dz(-dy);
    this.knob.style.transform = `translate(${dx * rad}px, ${dy * rad}px)`;
    this.el.classList.add('on');
  }
}

const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);

function button(parent, cls, html, onTap) {
  const b = document.createElement('button');
  b.className = `btn ${cls}`;
  b.innerHTML = html;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onTap(); });
  parent.appendChild(b);
  return b;
}

export class Controls {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.keys = new Set();
    this.sticks = {};
    this.buttons = {};
    this.layoutKey = '';
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.buttons.primary?.dispatchEvent(new Event('pointerdown')); e.preventDefault(); }
      if (e.code === 'KeyC') this.buttons.castle?.dispatchEvent(new Event('pointerdown'));
      if (e.code === 'Tab') { handlers.switchVehicle(); e.preventDefault(); }
      if (e.code === 'KeyX') handlers.toggleMode();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  layout(vehicle, expert) {
    const key = vehicle + expert;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.root.innerHTML = '';
    this.sticks = {};
    this.buttons = {};
    const s = this.sticks, b = this.buttons, h = this.h;
    if (vehicle === 'excavator') {
      if (expert) {
        s.left = new Stick(this.root, 'left', 'Stikke ↕ · Sving ↔');
        s.right = new Stick(this.root, 'right', 'Bom ↕ · Skuff ↔');
        s.trackL = new Stick(this.root, 'track-l', 'V', 'y');
        s.trackR = new Stick(this.root, 'track-r', 'H', 'y');
      } else {
        s.left = new Stick(this.root, 'left', 'Kjør');
        s.right = new Stick(this.root, 'right', 'Arm ↕ · Sving ↔');
        s.reach = new Stick(this.root, 'reach', 'Ut / Inn', 'y');
        b.primary = button(this.root, 'primary', '<span>🪣</span><small>Tøm</small>', () => h.primary());
      }
      b.castle = button(this.root, 'castle', '<span>🏰</span><small>Slott</small>', () => h.castle());
    } else {
      s.left = new Stick(this.root, 'left', 'Kjør');
      if (expert) s.tip = new Stick(this.root, 'reach', 'Tipp', 'y');
      else b.primary = button(this.root, 'primary', '<span>⤴</span><small>Tipp</small>', () => h.primary());
    }
  }

  setPrimaryLabel(html) {
    const b = this.buttons.primary;
    if (b && b.dataset.html !== html) { b.innerHTML = html; b.dataset.html = html; }
  }

  setCastleEnabled(on) { this.buttons.castle?.classList.toggle('disabled', !on); }

  read(vehicle, expert) {
    const k = (c) => (this.keys.has(c) ? 1 : 0);
    const s = this.sticks;
    const kb = {
      lx: k('KeyD') - k('KeyA'), ly: k('KeyW') - k('KeyS'),
      rx: k('ArrowRight') - k('ArrowLeft'), ry: k('ArrowUp') - k('ArrowDown'),
      lever: k('KeyE') - k('KeyQ'),
      ix: k('KeyL') - k('KeyJ'), iy: k('KeyI') - k('KeyK'),
    };
    const pick = (a, b) => (Math.abs(a) > Math.abs(b) ? a : b);
    const out = { lx: 0, ly: 0, rx: 0, ry: 0, reach: 0, trackL: 0, trackR: 0 };
    if (vehicle === 'excavator' && expert) {
      // WASD styrer beltene, IJKL venstre spak, piltaster høyre spak
      out.trackL = pick(s.trackL?.y ?? 0, clamp1(kb.ly + kb.lx));
      out.trackR = pick(s.trackR?.y ?? 0, clamp1(kb.ly - kb.lx));
      out.lx = pick(s.left?.x ?? 0, kb.ix); out.ly = pick(s.left?.y ?? 0, kb.iy);
      out.rx = pick(s.right?.x ?? 0, kb.rx); out.ry = pick(s.right?.y ?? 0, kb.ry);
    } else {
      out.lx = pick(s.left?.x ?? 0, kb.lx); out.ly = pick(s.left?.y ?? 0, kb.ly);
      out.rx = pick(s.right?.x ?? 0, kb.rx); out.ry = pick(s.right?.y ?? 0, kb.ry);
      out.reach = pick(s.reach?.y ?? 0, kb.lever);
      if (s.tip) out.ry = pick(s.tip.y, kb.ry);
    }
    return out;
  }

  // Er noen av spakene i bruk (så kameraet ikke også skal rotere)?
  busy() { return Object.values(this.sticks).some((s) => s.id !== null); }
}

const clamp1 = (v) => Math.max(-1, Math.min(1, v));
