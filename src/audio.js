// Syntetiserte, myke leketøyslyder med Web Audio. Ingen lydfiler.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);

    // Motor: to oscillatorer gjennom lavpass
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 2;
    this.engLp = lp;
    this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth'; this.osc1.frequency.value = 42;
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'square'; this.osc2.frequency.value = 63;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    this.osc1.connect(lp); this.osc2.connect(g2).connect(lp);
    lp.connect(this.engineGain).connect(this.master);
    // litt "putring"
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
    const lfoG = ctx.createGain(); lfoG.gain.value = 5;
    lfo.connect(lfoG).connect(this.osc1.frequency);
    this.lfo = lfo;
    [this.osc1, this.osc2, lfo].forEach((o) => o.start());

    // Hydraulikk-sus
    this.hyd = ctx.createOscillator(); this.hyd.type = 'triangle'; this.hyd.frequency.value = 320;
    this.hydGain = ctx.createGain(); this.hydGain.gain.value = 0;
    this.hyd.connect(this.hydGain).connect(this.master);
    this.hyd.start();

    // Sand: filtrert støy
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const mkNoise = (type, f, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(flt).connect(g).connect(this.master);
      src.start(0, Math.random() * 2);
      return g;
    };
    this.scrape = mkNoise('bandpass', 700, 0.9);
    this.pourG = mkNoise('highpass', 2600, 0.5);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }

  update({ throttle = 0, arm = 0, dig = 0, pour = 0, kind = 'excavator' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = 0.08;
    const load = Math.min(1, throttle + arm * 0.5 + dig * 30);
    const base = kind === 'truck' ? 55 : 40;
    this.osc1.frequency.setTargetAtTime(base + load * 30, t, k);
    this.osc2.frequency.setTargetAtTime((base + load * 30) * 1.5, t, k);
    this.lfo.frequency.setTargetAtTime(8 + load * 10, t, k);
    this.engLp.frequency.setTargetAtTime(300 + load * 500, t, k);
    this.engineGain.gain.setTargetAtTime(0.1 + load * 0.12, t, k);
    this.hyd.frequency.setTargetAtTime(280 + arm * 120, t, k);
    this.hydGain.gain.setTargetAtTime(Math.min(0.035, arm * 0.03), t, k);
    this.scrape.gain.setTargetAtTime(Math.min(0.5, dig * 60), t, 0.05);
    this.pourG.gain.setTargetAtTime(Math.min(0.25, pour * 0.8), t, 0.05);
  }

  // Liten pling / arpeggio
  blip(notes = [660], dur = 0.12, type = 'sine', vol = 0.18) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const t = t0 + i * dur * 0.8;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.6);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur * 1.7);
    });
  }
}
