/* Musique d'ambiance : sons de nature + accords doux, générés en direct (Web Audio).
   Aucun fichier audio : tout est synthétisé dans le navigateur, sans droits d'auteur. */
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
const pick = a => a[Math.floor(Math.random() * a.length)];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const ADVANCE_MS = 4 * 60 * 1000;
const MAJ = [[0, 7, 11, 16], [-3, 4, 7, 12], [5, 12, 16, 19], [2, 9, 12, 17]];
const MIN = [[0, 7, 10, 15], [-4, 3, 8, 12], [-2, 5, 9, 14], [-7, 0, 5, 8]];
const PENTA_MAJ = [0, 2, 4, 7, 9, 12, 14, 16];
const PENTA_MIN = [0, 3, 5, 7, 10, 12, 15];

let ctx = null, master, reverb, N = {}, current = null, playing = false;
let idx = Math.min(store.get('music-track', 0), 4), vol = store.get('music-vol', 0.6);
let advanceT = 0, suspendT = 0, silentEl = null;

/* ---------- moteur ---------- */
function init() {
  if (ctx) return true;
  try { ctx = new AC(); } catch (e) { return false; }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
  master = ctx.createGain(); master.gain.value = 0;
  master.connect(comp).connect(ctx.destination);
  reverb = ctx.createConvolver(); reverb.buffer = impulse(3.4);
  const wet = ctx.createGain(); wet.gain.value = 0.55;
  reverb.connect(wet).connect(master);
  N.white = noise('white'); N.pink = noise('pink'); N.brown = noise('brown');
  return true;
}
function noise(type, secs = 5) {
  const len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w;
      else if (type === 'pink') {
        b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
        b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
      } else { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
    }
  }
  return buf;
}
function impulse(sec) {
  const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}
const now = () => ctx.currentTime;
function filt(type, f, q = 0.7) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; }
function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
function pan(v) { if (!ctx.createStereoPanner) return gain(1); const p = ctx.createStereoPanner(); p.pan.value = v; return p; }
function hit(g, t, peak, a, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

/* une piste en cours : sources continues + évènements programmés */
function runtime() {
  const out = gain(0), fx = gain(0);
  out.connect(master); fx.connect(reverb);
  const rt = {
    out, fx, alive: true, timers: new Set(), srcs: [],
    later(fn, ms) {
      const h = setTimeout(() => { rt.timers.delete(h); if (rt.alive) { try { fn(); } catch (e) { console.error(e); } } }, ms);
      rt.timers.add(h);
    },
    keep(n) { rt.srcs.push(n); return n; },
    loop(type, ...chain) { // bruit en boucle → chaîne de nœuds → dernière cible
      const s = ctx.createBufferSource(); s.buffer = N[type]; s.loop = true;
      let node = s; chain.forEach(c => { node.connect(c); node = c; });
      s.start(0, rnd(0, 4)); return rt.keep(s);
    },
    lfo(freq, depth, ...params) {
      const o = ctx.createOscillator(), g = gain(depth); o.frequency.value = freq;
      o.connect(g); params.forEach(p => g.connect(p)); o.start(); return rt.keep(o);
    },
    burst(type, dur, dest, t = now() + 0.02) { // court morceau de bruit (goutte, crépitement…)
      const s = ctx.createBufferSource(); s.buffer = N[type]; s.loop = dur > 0.5;
      s.connect(dest); s.start(t, rnd(0, 4)); s.stop(t + dur + 0.05);
    },
    stop(sec = 3) {
      rt.alive = false;
      rt.timers.forEach(clearTimeout); rt.timers.clear();
      const t = now();
      [out, fx].forEach(g => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + sec); });
      setTimeout(() => { rt.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); out.disconnect(); fx.disconnect(); }, sec * 1000 + 300);
    }
  };
  return rt;
}

/* accords doux + notes de cloche, communs à toutes les pistes */
function music(rt, root, prog, scale) {
  const lp = filt('lowpass', 1000, 0.4), g = gain(1);
  lp.connect(g); g.connect(rt.out); g.connect(rt.fx);
  let k = 0;
  const chord = () => {
    const t = now() + 0.05, dur = 10;
    prog[k++ % prog.length].forEach(st => {
      [-7, 7].forEach(det => {
        const o = ctx.createOscillator(), e = gain(0);
        o.type = 'triangle'; o.frequency.value = mtof(root + st); o.detune.value = det;
        e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.016, t + 3.5);
        e.gain.setValueAtTime(0.016, t + dur - 1); e.gain.linearRampToValueAtTime(0, t + dur + 3);
        o.connect(e).connect(lp); o.start(t); o.stop(t + dur + 3.2);
      });
    });
    rt.later(chord, dur * 1000);
  };
  chord();
  const bellOut = gain(1); bellOut.connect(rt.fx);
  const dry = gain(0.5); bellOut.connect(dry).connect(rt.out);
  const bell = () => {
    const t = now() + 0.05, f = mtof(root + 12 + pick(scale)), p = pan(rnd(-0.5, 0.5));
    p.connect(bellOut);
    [[1, 0.03], [2.01, 0.008]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), e = gain(0); o.type = 'sine'; o.frequency.value = f * m;
      o.connect(e).connect(p); hit(e, t, a, 0.01, 2.8); o.start(t); o.stop(t + 3);
    });
    rt.later(bell, rnd(2500, 7500));
  };
  rt.later(bell, 2200);
}

/* ---------- les pistes ---------- */
const TRACKS = [
  {
    name: 'Vagues', sub: 'Mer calme et accords doux', root: 50, prog: MAJ, scale: PENTA_MAJ,
    build(rt) {
      const lp = filt('lowpass', 650, 0.3), g = gain(0.5);
      rt.loop('brown', lp, g); g.connect(rt.out);
      rt.lfo(0.085, 0.42, g.gain); rt.lfo(0.085, 380, lp.frequency); rt.lfo(0.047, 0.12, g.gain);
      const hp = filt('highpass', 2600), foam = gain(0.035);
      rt.loop('pink', hp, foam); foam.connect(rt.out); rt.lfo(0.085, 0.03, foam.gain);
    }
  },
  {
    name: 'Pluie', sub: 'Averse légère sur les toits', root: 45, prog: MIN, scale: PENTA_MIN,
    build(rt) {
      const hp = filt('highpass', 500), lp = filt('lowpass', 6500), g = gain(0.3);
      rt.loop('pink', hp, lp, g); g.connect(rt.out);
      const rum = gain(0.35); rt.loop('brown', filt('lowpass', 260), rum); rum.connect(rt.out);
      const drop = () => {
        const t = now() + 0.02, d = rnd(0.012, 0.035), bp = filt('bandpass', rnd(2200, 6500), 2), e = gain(0), p = pan(rnd(-0.85, 0.85));
        bp.connect(e).connect(p).connect(rt.out); hit(e, t, rnd(0.02, 0.1), 0.002, d); rt.burst('white', d, bp, t);
        rt.later(drop, rnd(25, 130));
      };
      drop();
      const thunder = () => {
        const t = now() + 0.05, lp2 = filt('lowpass', 140), e = gain(0);
        lp2.connect(e); e.connect(rt.out); e.connect(rt.fx);
        e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.55, t + 1.4); e.gain.linearRampToValueAtTime(0, t + 7);
        rt.burst('brown', 7, lp2, t);
        rt.later(thunder, rnd(30000, 70000));
      };
      rt.later(thunder, rnd(15000, 30000));
    }
  },
  {
    name: 'Forêt', sub: 'Vent dans les arbres et oiseaux', root: 48, prog: MAJ, scale: PENTA_MAJ,
    build(rt) {
      const bp = filt('bandpass', 500, 0.6), g = gain(0.22);
      rt.loop('brown', bp, g); g.connect(rt.out);
      rt.lfo(0.06, 0.16, g.gain); rt.lfo(0.06, 260, bp.frequency);
      const leaves = gain(0.018); rt.loop('pink', filt('highpass', 3200), leaves); leaves.connect(rt.out); rt.lfo(0.06, 0.014, leaves.gain);
      const bird = () => {
        const t0 = now() + 0.05, notes = Math.floor(rnd(2, 7)), base = rnd(2200, 4300), p = pan(rnd(-0.9, 0.9)), out = gain(1);
        out.connect(p); p.connect(rt.out); p.connect(rt.fx);
        let t = t0;
        for (let n = 0; n < notes; n++) {
          const len = rnd(0.05, 0.13), o = ctx.createOscillator(), e = gain(0), f = base * rnd(0.85, 1.15);
          o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * rnd(1.1, 1.5), t + len);
          o.connect(e).connect(out); hit(e, t, rnd(0.02, 0.045), 0.01, len); o.start(t); o.stop(t + len + 0.05);
          t += len + rnd(0.03, 0.09);
        }
        rt.later(bird, rnd(1200, 5500));
      };
      rt.later(bird, 800);
    }
  },
  {
    name: 'Nuit d’été', sub: 'Grillons et chouette au loin', root: 53, prog: MIN, scale: PENTA_MIN,
    build(rt) {
      const g = gain(0.1); rt.loop('brown', filt('lowpass', 300), g); g.connect(rt.out);
      [[4500, -0.6], [4800, 0.55]].forEach(([f, pv]) => {
        const o = rt.keep(ctx.createOscillator()), e = gain(0), p = pan(pv);
        o.frequency.value = f + rnd(-120, 120); o.connect(e).connect(p).connect(rt.out); o.start();
        const chirp = () => {
          let t = now() + 0.03; const pulses = Math.floor(rnd(3, 5)), a = rnd(0.008, 0.016);
          for (let i = 0; i < pulses; i++) { e.gain.setValueAtTime(a, t); e.gain.setValueAtTime(0, t + 0.018); t += 0.032; }
          rt.later(chirp, Math.random() < 0.12 ? rnd(2000, 4000) : rnd(420, 820));
        };
        rt.later(chirp, rnd(0, 600));
      });
      const owl = () => {
        const out = gain(1); out.connect(rt.out); out.connect(rt.fx);
        [[0, 0.45], [0.75, 0.9]].forEach(([off, len]) => {
          const t = now() + 0.05 + off, o = ctx.createOscillator(), e = gain(0);
          o.frequency.setValueAtTime(410, t); o.frequency.linearRampToValueAtTime(370, t + len);
          o.connect(e).connect(out); hit(e, t, 0.05, 0.08, len); o.start(t); o.stop(t + len + 0.2);
        });
        rt.later(owl, rnd(18000, 40000));
      };
      rt.later(owl, rnd(6000, 12000));
    }
  },
  {
    name: 'Feu de camp', sub: 'Crépitements au coucher du soleil', root: 52, prog: MAJ, scale: PENTA_MAJ,
    build(rt) {
      const g = gain(0.28); rt.loop('brown', filt('lowpass', 420), g); g.connect(rt.out); rt.lfo(0.18, 0.07, g.gain);
      const crackle = () => {
        const t = now() + 0.02, d = rnd(0.004, 0.022), hp = filt('highpass', rnd(1400, 4200)), e = gain(0), p = pan(rnd(-0.6, 0.6));
        hp.connect(e).connect(p).connect(rt.out); hit(e, t, rnd(0.04, 0.3), 0.001, d); rt.burst('white', d, hp, t);
        rt.later(crackle, Math.random() < 0.35 ? rnd(15, 60) : rnd(120, 650));
      };
      crackle();
    }
  }
];

function startTrack(i) {
  const T = TRACKS[i], rt = runtime();
  T.build(rt);
  music(rt, T.root, T.prog, T.scale);
  const t = now();
  [rt.out, rt.fx].forEach(g => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 3); });
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
  ctx.resume();
  silentLoop().play().catch(() => {});
  if (!current) current = startTrack(idx);
  rampMaster(vol, 1.5);
  playing = true; store.set('music-on', true);
  scheduleAdvance(); render();
  if (window.YL) window.YL.unlock('ambiance');
}
function pause(remember = true) {
  if (!ctx || !playing) return;
  rampMaster(0, 0.8);
  playing = false; if (remember) store.set('music-on', false);
  clearTimeout(advanceT);
  suspendT = setTimeout(() => { if (!playing) { ctx.suspend(); if (silentEl) silentEl.pause(); } }, 900);
  render();
}
function select(i) {
  idx = (i + TRACKS.length) % TRACKS.length; store.set('music-track', idx);
  if (playing) { current.stop(3); current = startTrack(idx); scheduleAdvance(); render(); }
  else { if (current) { current.stop(0.1); current = null; } play(); }
}

/* ---------- interface ---------- */
const hud = $('.hud'), soundBtn = $('#hud-sound');
if (!hud) return;
const btn = document.createElement('button');
btn.className = 'hud-btn music-btn'; btn.id = 'hud-music'; btn.dataset.cursor = 'link';
btn.setAttribute('aria-label', 'Musique d’ambiance'); btn.setAttribute('aria-expanded', 'false');
btn.innerHTML = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
hud.insertBefore(btn, soundBtn || null);

const panel = document.createElement('div');
panel.className = 'mp'; panel.id = 'music-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Musique d’ambiance');
panel.innerHTML = `
  <div class="mp-head"><small>Ambiance · sons de nature</small><button class="mp-x" data-cursor="link" aria-label="Fermer">✕</button></div>
  <div class="mp-now">
    <button class="mp-play" id="mp-play" data-cursor="link" aria-label="Lecture"></button>
    <div class="mp-meta"><b id="mp-title"></b><span id="mp-sub"></span></div>
  </div>
  <div class="mp-ctrl">
    <button class="mp-skip" id="mp-prev" data-cursor="link" aria-label="Piste précédente">⏮</button>
    <label class="mp-vol"><span aria-hidden="true">🔉</span><input type="range" id="mp-vol" min="0" max="1" step="0.01" aria-label="Volume"></label>
    <button class="mp-skip" id="mp-next" data-cursor="link" aria-label="Piste suivante">⏭</button>
  </div>
  <ol class="mp-list">${TRACKS.map((t, i) => `
    <li><button data-i="${i}" data-cursor="link"><span class="mp-n">${String(i + 1).padStart(2, '0')}</span>
      <span class="mp-t"><b>${t.name}</b><small>${t.sub}</small></span>
      <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button></li>`).join('')}
  </ol>
  <p class="mp-note">Sons générés en direct dans ton navigateur · piste suivante toutes les 4 min</p>`;
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
  panel.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open));
};
btn.addEventListener('click', e => {
  e.stopPropagation();
  const open = !panel.classList.contains('open');
  openPanel(open);
  if (open && !playing && !store.get('music-asked', false)) { store.set('music-asked', true); play(); } // 1er clic : on lance
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

// onglet caché : on coupe en douceur, on reprend au retour
let pausedByHide = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) { pausedByHide = true; pause(false); }
  else if (!document.hidden && pausedByHide) { pausedByHide = false; play(); }
});

// si la musique était active à la dernière visite : reprise au premier clic (les navigateurs bloquent l'autoplay)
if (store.get('music-on', false)) {
  btn.classList.add('hint');
  const resume = e => {
    if (e.target.closest && e.target.closest('#hud-music, #music-panel')) return;
    removeEventListener('pointerdown', resume, true); removeEventListener('keydown', resume, true);
    if (!playing) play();
  };
  addEventListener('pointerdown', resume, true); addEventListener('keydown', resume, true);
}
render();
window.YLMusic = { play, pause, select, tracks: TRACKS };
})();
