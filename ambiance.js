/* Playlist d'ambiance : instrus trap originales façon Future / Young Thug (type beats),
   composées et jouées en direct par le navigateur (Web Audio). Aucun fichier audio, aucun sample. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('yl:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('yl:' + k, JSON.stringify(v)); } catch (e) {} }
};
const AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return;

const rnd = (a, b) => a + Math.random() * (b - a);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const N = s => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); return 12 * (+m[3] + 1) + NOTES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const notes = list => list.map(([st, n, len, v]) => [st, N(n), len, v == null ? 1 : v]);
const ADVANCE_MS = 3 * 60 * 1000;

/* ---------- les morceaux (4 mesures de 16 doubles-croches, en boucle) ---------- */
const TRACKS = [
  {
    name: 'Flûte de minuit', sub: 'Future type beat · 140 BPM', bpm: 140,
    chords: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['D3', 'F3', 'A3'], ['E3', 'G#3', 'B3']],
    roots: ['A1', 'F1', 'D2', 'E1'], pad: 'pad',
    bass: [[0, 0, 6], [7, 0, 3], [10, 0, 4], [14, 12, 2, true]],
    kick: 'x......x..x.....', clap: '........x.......', hats: 'x.x.x.x.x.x.x.x.',
    lead: { inst: 'flute', notes: notes([
      [0, 'E5', 3], [3, 'D5', 3], [6, 'C5', 2], [8, 'B4', 4], [12, 'C5', 2], [14, 'B4', 2],
      [16, 'A4', 6], [24, 'E4', 2], [26, 'G#4', 2], [28, 'A4', 4],
      [32, 'F5', 3], [35, 'E5', 3], [38, 'D5', 2], [40, 'C5', 4], [44, 'D5', 2], [46, 'C5', 2],
      [48, 'B4', 6], [56, 'G#4', 2], [58, 'B4', 2], [60, 'E5', 4]]) }
  },
  {
    name: 'Bounce', sub: 'Young Thug type beat · 150 BPM', bpm: 150,
    chords: [['D4', 'F4', 'A4', 'C5'], ['Bb3', 'D4', 'F4', 'A4'], ['F3', 'A3', 'C4', 'F4'], ['C4', 'E4', 'G4', 'C5']],
    roots: ['D2', 'Bb1', 'F1', 'C2'], pad: 'soft',
    bass: [[0, 0, 3], [3, 0, 2], [6, 12, 2], [8, 0, 4], [13, 0, 3]],
    kick: 'x..x..x.x....x..', clap: '........x.......', hats: 'x.xxx.x.x.xxx.x.',
    lead: { inst: 'pluck', notes: notes([
      [0, 'A5', 1], [2, 'F5', 1], [3, 'A5', 1], [6, 'D6', 2], [8, 'C6', 1], [10, 'A5', 1], [12, 'F5', 2], [14, 'G5', 1],
      [16, 'F5', 1], [18, 'D5', 1], [19, 'F5', 1], [22, 'Bb5', 2], [24, 'A5', 1], [26, 'F5', 1], [28, 'D5', 2], [30, 'C5', 1],
      [32, 'C6', 1], [34, 'A5', 1], [35, 'C6', 1], [38, 'F6', 2], [40, 'E6', 1], [42, 'C6', 1], [44, 'A5', 2], [46, 'G5', 1],
      [48, 'G5', 1], [50, 'E5', 1], [51, 'G5', 1], [54, 'C6', 2], [56, 'D6', 1], [58, 'E6', 1], [60, 'G6', 2], [62, 'E6', 1]]) },
    lead2: { inst: 'bell', odd: true, notes: notes([[0, 'D6', 8, .8], [16, 'F6', 8, .8], [32, 'C6', 8, .8], [48, 'E6', 8, .8]]) }
  },
  {
    name: 'Piano sombre', sub: 'Future type beat · 136 BPM', bpm: 136,
    chords: [['C4', 'Eb4', 'G4'], ['Ab3', 'C4', 'Eb4'], ['Eb3', 'G3', 'Bb3'], ['G3', 'B3', 'D4']],
    roots: ['C2', 'Ab1', 'Eb2', 'G1'], pad: 'choir',
    bass: [[0, 0, 10], [11, 0, 2], [14, 7, 2, true]],
    kick: 'x.........x..x..', clap: '........x.......', hats: 'x.x.x.x.x.x.x.x.',
    arp: { inst: 'piano', every: 2, octave: 12, pattern: [0, 2, 1, 2, 3, 2, 1, 2] },
    lead2: { inst: 'bell', odd: true, notes: notes([[0, 'G5', 8, .7], [16, 'Eb5', 8, .7], [32, 'Bb5', 8, .7], [48, 'D5', 8, .7]]) }
  },
  {
    name: 'Guitare d’Atlanta', sub: 'Young Thug type beat · 145 BPM', bpm: 145,
    chords: [['E3', 'B3', 'E4', 'G4'], ['C3', 'G3', 'C4', 'E4'], ['G3', 'D4', 'G4', 'B4'], ['D3', 'A3', 'D4', 'F#4']],
    roots: ['E1', 'C2', 'G1', 'D2'], pad: 'soft',
    bass: [[0, 0, 4], [6, 0, 2], [8, 0, 3], [11, 12, 2], [14, 0, 2]],
    kick: 'x.....x.x.....x.', clap: '........x.......', hats: 'x.x.x.xxx.x.x.xx',
    arp: { inst: 'guitar', every: 2, octave: 12, pattern: [0, 1, 2, 3, 1, 2, 3, 2] },
    lead2: { inst: 'bell', odd: true, notes: notes([
      [0, 'B5', 2], [2, 'G5', 2], [4, 'E5', 6], [16, 'C6', 2], [18, 'G5', 2], [20, 'E5', 6],
      [32, 'D6', 2], [34, 'B5', 2], [36, 'G5', 6], [48, 'F#5', 2], [50, 'A5', 2], [52, 'D6', 6]]) }
  },
  {
    name: 'Cloches', sub: 'Future type beat · 142 BPM', bpm: 142,
    chords: [['F#3', 'A3', 'C#4'], ['D3', 'F#3', 'A3'], ['A3', 'C#4', 'E4'], ['C#3', 'F3', 'G#3']],
    roots: ['F#1', 'D2', 'A1', 'C#2'], pad: 'pad',
    bass: [[0, 0, 6], [6, 0, 2], [10, 0, 4], [14, 7, 2, true]],
    kick: 'x.....x...x.....', clap: '........x.......', hats: 'x.x.x.x.x.x.x.x.',
    lead: { inst: 'bell', notes: notes([
      [0, 'C#6', 2], [2, 'A5', 2], [4, 'F#5', 4], [10, 'A5', 2], [12, 'C#6', 4],
      [16, 'D6', 2], [18, 'A5', 2], [20, 'F#5', 4], [26, 'E5', 2], [28, 'F#5', 4],
      [32, 'E6', 2], [34, 'C#6', 2], [36, 'A5', 4], [42, 'B5', 2], [44, 'C#6', 4],
      [48, 'F5', 3], [51, 'G#5', 3], [54, 'B5', 2], [56, 'C#6', 8]]) }
  }
];
TRACKS.forEach(T => {
  T.chords = T.chords.map(c => c.map(N)); T.roots = T.roots.map(N);
  [T.lead, T.lead2].forEach(L => { if (L) { L.map = {}; L.notes.forEach(n => (L.map[n[0]] = L.map[n[0]] || []).push(n)); } });
});

/* ---------- moteur ---------- */
let ctx = null, master, reverb, WHITE, CURVE, current = null, playing = false;
let idx = Math.min(store.get('beat-track', 0), TRACKS.length - 1), vol = store.get('music-vol', 0.6);
let advanceT = 0, suspendT = 0, silentEl = null;

function init() {
  if (ctx) return true;
  try { ctx = new AC(); } catch (e) { return false; }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.005; comp.release.value = 0.25;
  master = ctx.createGain(); master.gain.value = 0;
  const trim = ctx.createGain(); trim.gain.value = 0.5;
  master.connect(comp).connect(trim).connect(ctx.destination);
  reverb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  reverb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.5; reverb.connect(wet).connect(master);
  WHITE = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const w = WHITE.getChannelData(0); for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
  CURVE = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; CURVE[i] = Math.tanh(2.6 * x); }
  return true;
}
const now = () => ctx.currentTime;
const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
const filt = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
const panner = v => { if (!ctx.createStereoPanner) return gain(1); const p = ctx.createStereoPanner(); p.pan.value = v; return p; };
const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
function env(g, t, peak, a, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function noiseHit(t, dur, dest) { const s = ctx.createBufferSource(); s.buffer = WHITE; s.connect(dest); s.start(t, rnd(0, 1.5)); s.stop(t + dur + 0.02); }

/* ---------- instruments ---------- */
const DRUMS = {
  kick(t, out) {
    const o = osc('sine', 160), g = gain(0);
    o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    o.connect(g).connect(out); env(g, t, 0.75, 0.002, 0.26); o.start(t); o.stop(t + 0.32);
  },
  clap(t, out) {
    const bp = filt('bandpass', 1700, 0.9), g = gain(0); bp.connect(g).connect(out);
    g.gain.setValueAtTime(0.0001, t);
    [0, 0.011, 0.022].forEach(o => { g.gain.setValueAtTime(0.32, t + o); g.gain.exponentialRampToValueAtTime(0.05, t + o + 0.009); });
    g.gain.setValueAtTime(0.36, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    noiseHit(t, 0.26, bp);
    const b = osc('triangle', 190), bg = gain(0); b.connect(bg).connect(out); env(bg, t, 0.18, 0.002, 0.07); b.start(t); b.stop(t + 0.1);
  },
  hat(t, out, vel = 1, open = false) {
    const hp = filt('highpass', 7800, 0.8), g = gain(0), p = panner(0.18);
    hp.connect(g).connect(p).connect(out); env(g, t, 0.11 * vel, 0.001, open ? 0.2 : 0.032); noiseHit(t, open ? 0.25 : 0.05, hp);
  }
};
function play808(rt, t, midi, len, glide) {
  const f = mtof(midi);
  if (rt.last808) { // monophonique : on coupe la note précédente
    const L = rt.last808; L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value || 0.3, t); L.g.gain.linearRampToValueAtTime(0.0001, t + 0.02); try { L.o.stop(t + 0.05); } catch (e) {}
  }
  const o = osc('sine', f), sh = ctx.createWaveShaper(), g = gain(0), lp = filt('lowpass', 900, 0.5);
  sh.curve = CURVE;
  if (glide && rt.lastF) { o.frequency.setValueAtTime(rt.lastF, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09); }
  o.connect(sh).connect(lp).connect(g).connect(rt.bass);
  const end = t + Math.min(len, 1.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.006);
  g.gain.setValueAtTime(0.32, end - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.25);
  o.start(t); o.stop(end + 0.3);
  rt.last808 = { o, g }; rt.lastF = f;
}
const INST = {
  flute(t, m, dur, out, v) {
    const f = mtof(m), g = gain(0), lp = filt('lowpass', 3200), a = osc('sine', f), b = osc('triangle', f * 2), bg = gain(0.12);
    const vib = osc('sine', 5.4), vg = gain(0); vib.connect(vg); vg.connect(a.detune); vg.connect(b.detune);
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(14, t + Math.min(dur, 0.35));
    a.connect(g); b.connect(bg).connect(g); g.connect(lp).connect(out);
    const pk = 0.22 * v, end = t + dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + 0.07);
    g.gain.setValueAtTime(pk * 0.85, Math.max(t + 0.08, end - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.18);
    const br = filt('bandpass', f * 1.5, 1.2), bgn = gain(0); br.connect(bgn).connect(out); env(bgn, t, 0.03 * v, 0.02, 0.12); noiseHit(t, 0.15, br);
    [a, b, vib].forEach(o => { o.start(t); o.stop(end + 0.25); });
  },
  bell(t, m, dur, out, v) {
    const f = mtof(m), c = osc('sine', f), mo = osc('sine', f * 3.5), mg = gain(f * 1.6), g = gain(0), h = osc('sine', f * 2), hg = gain(0.25);
    mg.gain.setValueAtTime(f * 1.8, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.2);
    mo.connect(mg).connect(c.frequency); c.connect(g); h.connect(hg).connect(g); g.connect(out);
    env(g, t, 0.15 * v, 0.004, Math.max(1.4, dur));
    [c, mo, h].forEach(o => { o.start(t); o.stop(t + Math.max(1.4, dur) + 0.1); });
  },
  pluck(t, m, dur, out, v) {
    const f = mtof(m);
    [[-8, -0.35], [8, 0.35]].forEach(([det, pv]) => {
      const o = osc('sawtooth', f), lp = filt('lowpass', 4200, 3), g = gain(0), p = panner(pv);
      o.detune.value = det;
      lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.22);
      o.connect(lp).connect(g).connect(p).connect(out); env(g, t, 0.09 * v, 0.003, 0.32); o.start(t); o.stop(t + 0.4);
    });
  },
  guitar(t, m, dur, out, v) {
    const f = mtof(m), o = osc('sawtooth', f), o2 = osc('triangle', f * 1.003), lp = filt('lowpass', 2600, 1.4), g = gain(0), p = panner(rnd(-0.3, 0.3));
    lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.5);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(p).connect(out); env(g, t, 0.085 * v, 0.003, 0.9);
    [o, o2].forEach(x => { x.start(t); x.stop(t + 1); });
  },
  piano(t, m, dur, out, v) {
    const f = mtof(m), lp = filt('lowpass', 2400), g = gain(0);
    [[1, 1], [2, 0.3], [3, 0.1]].forEach(([k, a]) => { const o = osc(k === 1 ? 'triangle' : 'sine', f * k), og = gain(a); o.connect(og).connect(lp); o.start(t); o.stop(t + 2); });
    lp.connect(g).connect(out); env(g, t, 0.13 * v, 0.004, 1.7);
  }
};
function pad(kind, t, chord, dur, out) {
  const type = kind === 'choir' ? 'triangle' : 'sawtooth', lp = filt('lowpass', kind === 'soft' ? 1400 : 900, 0.5), g = gain(0);
  lp.connect(g).connect(out);
  const pk = kind === 'soft' ? 0.05 : 0.07;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.6);
  g.gain.setValueAtTime(pk, t + dur - 0.2); g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
  chord.forEach(m => [-9, 9].forEach(det => {
    const o = osc(type, mtof(m)); o.detune.value = det; const og = gain(0.22); o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.7);
  }));
}

/* ---------- séquenceur ---------- */
function startTrack(i) {
  const T = TRACKS[i], sd = 60 / T.bpm / 4; // durée d'une double-croche
  const out = gain(0), fx = gain(0); out.connect(master); fx.connect(reverb);
  const rt = { alive: true, last808: null, lastF: 0 };
  rt.drums = gain(1); rt.drums.connect(out);
  rt.bass = gain(1); rt.bass.connect(out);
  const leadF = filt('lowpass', 700, 0.6); rt.lead = leadF;
  const leadG = gain(1); leadF.connect(leadG); leadG.connect(out);
  const send = gain(0.45); leadG.connect(send).connect(fx);
  const delay = ctx.createDelay(1.5), fb = gain(0.32), dlp = filt('lowpass', 2400), dret = gain(0.3);
  delay.delayTime.value = sd * 3; leadG.connect(delay); delay.connect(dlp).connect(fb).connect(delay); dlp.connect(dret).connect(out);
  rt.pad = gain(1); rt.pad.connect(out); const padSend = gain(0.6); rt.pad.connect(padSend).connect(fx);
  const t0 = now() + 0.1;
  [out, fx].forEach(g => { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + 1.2); });
  leadF.frequency.setValueAtTime(700, t0); leadF.frequency.exponentialRampToValueAtTime(14000, t0 + sd * 32); // intro filtrée

  let step = 0, next = t0, rolls = {};
  const tick = () => {
    while (rt.alive && next < now() + 0.18) { schedule(step, next); next += sd; step++; }
  };
  function schedule(s, t) {
    const bar = Math.floor(s / 16), pos = s % 16, lb = bar % 4, ph = bar % 16, loop = Math.floor(bar / 4);
    const drums = ph >= 2 && ph < 14, half = ph >= 14;
    const chord = T.chords[lb], swing = (pos % 2 ? sd * 0.04 : 0);
    if (pos === 0) {
      pad(T.pad, t, chord, sd * 16, rt.pad);
      if (bar % 2 === 1) { // rafales de charleston sur la fin des mesures impaires
        rolls = {}; const at = Math.random() < 0.5 ? 12 : 14;
        rolls[at] = Math.random() < 0.5 ? 3 : 2; rolls[at + 1] = Math.random() < 0.3 ? 4 : rolls[at];
      } else rolls = {};
    }
    // batterie
    if (drums) {
      if (T.kick[pos] === 'x') DRUMS.kick(t, rt.drums);
      if (T.clap[pos] === 'x') DRUMS.clap(t, rt.drums);
      if (ph === 13 && pos >= 12) DRUMS.clap(t, rt.drums); // petit roulement avant la pause
    }
    if (drums || half) {
      const n = rolls[pos];
      if (n && drums) for (let k = 0; k < n; k++) DRUMS.hat(t + k * sd / n, rt.drums, 0.75 + 0.25 * (k === 0));
      else if (T.hats[pos] === 'x' && (drums || pos % 4 === 0)) DRUMS.hat(t + swing, rt.drums, pos % 4 === 0 ? 1 : 0.7);
      if (drums && pos === 6 && bar % 4 === 3) DRUMS.hat(t, rt.drums, 0.8, true);
    }
    // 808
    if (drums) T.bass.forEach(([st, semi, len, glide]) => { if (st === pos) play808(rt, t, T.roots[lb] + semi, len * sd, glide); });
    if (ph === 2 && pos === 0 && !T.bass.some(b => b[0] === 0)) play808(rt, t, T.roots[lb], sd * 6);
    // mélodie
    const ls = s % 64;
    [T.lead, T.lead2].forEach(L => {
      if (!L || !L.map[ls] || (L.odd && loop % 2 === 0)) return;
      L.map[ls].forEach(([, m, len, v]) => INST[L.inst](t, m, len * sd, rt.lead, v));
    });
    if (T.arp && pos % T.arp.every === 0) {
      const ext = chord.concat(chord.map(m => m + 12)), k = T.arp.pattern[(pos / T.arp.every) % T.arp.pattern.length];
      INST[T.arp.inst](t + swing, ext[k] + (T.arp.octave || 0), sd * T.arp.every, rt.lead, pos % 4 === 0 ? 1 : 0.75);
    }
  }
  tick();
  const iv = setInterval(tick, 25);
  rt.stop = (sec = 2) => {
    rt.alive = false; clearInterval(iv);
    const t = now();
    [out, fx].forEach(g => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + sec); });
    setTimeout(() => { out.disconnect(); fx.disconnect(); }, sec * 1000 + 2500);
  };
  return rt;
}

/* ---------- contrôles ---------- */
function rampMaster(to, sec) {
  const t = now(); master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(to, t + sec);
}
function silentLoop() { // iPhone : permet d'entendre le son même avec le bouton silencieux
  if (silentEl) return silentEl;
  const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, s) => [...s].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  silentEl = new Audio(URL.createObjectURL(new Blob([b], { type: 'audio/wav' })));
  silentEl.loop = true; silentEl.setAttribute('playsinline', '');
  return silentEl;
}
function scheduleAdvance() { clearTimeout(advanceT); advanceT = setTimeout(() => select(idx + 1), ADVANCE_MS); }
function play() {
  if (!init()) return;
  clearTimeout(suspendT);
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  ctx.resume().catch(() => {});
  silentLoop().play().catch(() => {});
  if (!current) current = startTrack(idx);
  rampMaster(vol, 0.8);
  playing = true; store.set('music-on', true);
  scheduleAdvance(); render();
  if (window.YL) window.YL.unlock('ambiance');
}
function pause(remember = true) {
  if (!ctx || !playing) return;
  rampMaster(0, 0.6);
  playing = false; if (remember) store.set('music-on', false);
  clearTimeout(advanceT);
  suspendT = setTimeout(() => { if (!playing) { if (current) { current.stop(0.05); current = null; } ctx.suspend(); if (silentEl) silentEl.pause(); } }, 700);
  render();
}
function select(i) {
  idx = (i + TRACKS.length) % TRACKS.length; store.set('beat-track', idx);
  if (playing) { current.stop(1.5); current = startTrack(idx); scheduleAdvance(); render(); }
  else { if (current) { current.stop(0.05); current = null; } play(); }
}

/* ---------- interface ---------- */
const hud = $('.hud'), soundBtn = $('#hud-sound');
if (!hud) return;
const btn = document.createElement('button');
btn.className = 'hud-btn music-btn'; btn.id = 'hud-music'; btn.dataset.cursor = 'link';
btn.setAttribute('aria-label', 'Playlist'); btn.setAttribute('aria-expanded', 'false');
btn.innerHTML = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
hud.insertBefore(btn, soundBtn || null);

const panel = document.createElement('div');
panel.className = 'mp'; panel.id = 'music-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Playlist');
panel.innerHTML = `
  <div class="mp-head"><small>Playlist · type beats</small><button class="mp-x" data-cursor="link" aria-label="Fermer">✕</button></div>
  <div class="mp-now">
    <button class="mp-play" id="mp-play" data-cursor="link" aria-label="Lecture"></button>
    <div class="mp-meta"><b id="mp-title"></b><span id="mp-sub"></span></div>
  </div>
  <div class="mp-ctrl">
    <button class="mp-skip" id="mp-prev" data-cursor="link" aria-label="Morceau précédent">⏮</button>
    <label class="mp-vol"><span aria-hidden="true">🔉</span><input type="range" id="mp-vol" min="0" max="1" step="0.01" aria-label="Volume"></label>
    <button class="mp-skip" id="mp-next" data-cursor="link" aria-label="Morceau suivant">⏭</button>
  </div>
  <ol class="mp-list">${TRACKS.map((t, i) => `
    <li><button data-i="${i}" data-cursor="link"><span class="mp-n">${String(i + 1).padStart(2, '0')}</span>
      <span class="mp-t"><b>${t.name}</b><small>${t.sub}</small></span>
      <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button></li>`).join('')}
  </ol>
  <p class="mp-note">Instrus originales jouées en direct dans ton navigateur · morceau suivant toutes les 3 min</p>`;
document.body.appendChild(panel);

const volEl = $('#mp-vol');
volEl.value = vol;
function render() {
  document.body.classList.toggle('music-on', playing);
  const T = TRACKS[idx];
  $('#mp-title').textContent = T.name; $('#mp-sub').textContent = T.sub;
  const pb = $('#mp-play'); pb.textContent = playing ? '❚❚' : '▶'; pb.setAttribute('aria-label', playing ? 'Pause' : 'Lecture');
  panel.querySelectorAll('.mp-list button').forEach(b => {
    const on = +b.dataset.i === idx; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false');
  });
  btn.classList.toggle('on', playing);
}
const openPanel = open => {
  if (open !== panel.classList.contains('open') && window.YL && window.YL.sound) window.YL.sound[open ? 'open' : 'close']();
  panel.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open));
};
btn.addEventListener('click', e => {
  e.stopPropagation();
  const open = !panel.classList.contains('open');
  openPanel(open);
  if (open && !playing) play(); // en ouvrant la playlist, le son démarre
  btn.classList.remove('hint');
});
$('#mp-play').addEventListener('click', () => (playing ? pause() : play()));
$('#mp-prev').addEventListener('click', () => select(idx - 1));
$('#mp-next').addEventListener('click', () => select(idx + 1));
$('.mp-x').addEventListener('click', () => openPanel(false));
panel.querySelectorAll('.mp-list button').forEach(b => b.addEventListener('click', () => select(+b.dataset.i)));
volEl.addEventListener('input', () => { vol = +volEl.value; store.set('music-vol', vol); if (playing) rampMaster(vol, 0.15); });
document.addEventListener('click', e => { if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn) openPanel(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') openPanel(false); });

// onglet caché : on coupe, on reprend au retour
let pausedByHide = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) { pausedByHide = true; pause(false); }
  else if (!document.hidden && pausedByHide) { pausedByHide = false; play(); }
});

// musique active à la dernière visite : reprise au premier clic (les navigateurs bloquent l'autoplay)
if (store.get('music-on', false)) {
  btn.classList.add('hint');
  const resume = e => {
    if (e.target.closest && e.target.closest('#hud-music, #music-panel')) return;
    ['click', 'touchend', 'keydown'].forEach(ev => removeEventListener(ev, resume, true));
    if (!playing) play();
  };
  ['click', 'touchend', 'keydown'].forEach(ev => addEventListener(ev, resume, true));
}
render();
window.YLMusic = { play, pause, select, tracks: TRACKS };
})();
