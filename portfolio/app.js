(() => {
'use strict';
document.body.classList.add('is-loading');
const S = window.SITE;
const PAGE = document.body.dataset.page || 'home';
const HOME = PAGE === 'home';
const P = window.PHOTOS || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const pad = (n, l = 2) => String(n).padStart(l, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const store = {
  get(k, d) { try { const v = localStorage.getItem('yl:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('yl:' + k, JSON.stringify(v)); } catch (e) {} }
};

/* ================= DONNÉES ================= */
const RATIOS = ['4/5', '3/2', '2/3', '1/1', '4/5', '3/2', '2/3', '4/5', '3/2', '1/1', '2/3', '3/2'];
const galleries = S.galleries.map(g => {
  const photos = (P[g.id] || []).filter(p => p && p.src);
  const unlocked = photos.length > 0 || !!g.open;
  const items = photos.length
    ? photos.map((p, i) => ({ ...p, id: g.id + ':' + p.src, n: i + 1 }))
    : (g.open ? Array.from({ length: g.placeholders || 9 }, (_, i) => ({ placeholder: true, id: g.id + ':ph' + i, n: i + 1, ratio: RATIOS[i % RATIOS.length] })) : []);
  return { ...g, photos, items, unlocked };
});
const totalPhotos = galleries.reduce((a, g) => a + g.photos.length, 0);
const allPhotos = galleries.flatMap(g => g.photos);
const heroPics = (() => {
  const pick = (S.hero || []).map(src => allPhotos.find(p => p.src === src)).filter(Boolean);
  return (pick.length ? pick : allPhotos).slice(0, 8);
})();
let startHero = () => {};

/* ================= SON ================= */
let actx = null;
const sound = {
  on: store.get('sound', false),
  ctx() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return actx; },
  shutter() {
    if (!this.on) return; const c = this.ctx(); if (!c) return;
    [0, 0.07].forEach((t0, k) => {
      const len = 0.045, buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.value = k ? 2400 : 3800; f.Q.value = .8; g.gain.value = k ? .35 : .5;
      src.connect(f).connect(g).connect(c.destination); src.start(c.currentTime + t0);
    });
  },
  blip(freqs = [660, 990], dur = .09) {
    if (!this.on) return; const c = this.ctx(); if (!c) return;
    freqs.forEach((fq, i) => {
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * dur;
      o.type = 'triangle'; o.frequency.value = fq; g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.18, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur * 1.6);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur * 2);
    });
  }
};
const soundBtn = $('#hud-sound');
const renderSound = () => { soundBtn.textContent = sound.on ? '🔊' : '🔇'; soundBtn.setAttribute('aria-label', sound.on ? 'Couper le son' : 'Activer le son'); };
soundBtn.addEventListener('click', () => { sound.on = !sound.on; store.set('sound', sound.on); renderSound(); sound.blip([520, 780]); });
renderSound();

/* ================= GAMIFICATION ================= */
const LEVELS = [[0, 'Débutant'], [60, 'Amateur'], [160, 'Œil affûté'], [320, 'Reporter'], [520, 'Pro'], [800, 'Légende']];
const ACH = [
  { id: 'first-shot', ico: '📸', title: 'Premier déclic', desc: 'Ouvre ta première photo.', xp: 20 },
  { id: 'burst', ico: '⚡', title: 'Rafale', desc: 'Déclenche 10 fois dans le viseur en moins de 4 s.', xp: 25 },
  { id: 'full-roll', ico: '🎞️', title: 'Pellicule complète', desc: "Vois toutes les photos d'une galerie.", xp: 60 },
  { id: 'curious', ico: '🔒', title: 'Trop pressé', desc: 'Essaie d\'ouvrir une pellicule pas encore développée.', xp: 10 },
  { id: 'slideshow', ico: '🎬', title: 'Diaporama', desc: 'Regarde toutes les photos de l\'accueil défiler.', xp: 30 },
  { id: 'selection', ico: '🎯', title: 'Toute la sélection', desc: 'Fais défiler toute la sélection.', xp: 30 },
  { id: 'gallery', ico: '🖼️', title: 'Dans la galerie', desc: 'Ouvre la page d\'une pellicule.', xp: 20 },
  { id: 'hidden-ball', ico: '👁️', title: 'Œil de lynx', desc: 'Trouve le bouchon d\'objectif caché sur le site.', xp: 40 },
  { id: 'konami', ico: '🕹️', title: 'Old school', desc: 'Entre le code secret → mode argentique.', xp: 40 },
  { id: 'explorer', ico: '🧭', title: 'Explorateur', desc: 'Descends jusqu\'au bout du site.', xp: 15 },
  { id: 'contact', ico: '✉️', title: 'Prise de contact', desc: 'Clique pour me contacter.', xp: 25 }
];
const state = {
  xp: store.get('xp', 0),
  seen: new Set(store.get('seen', [])),
  ach: new Set(store.get('ach', []))
};
const save = () => { store.set('xp', state.xp); store.set('seen', [...state.seen]); store.set('ach', [...state.ach]); };
const levelOf = xp => { let i = 0; LEVELS.forEach((l, k) => { if (xp >= l[0]) i = k; }); return { i, name: LEVELS[i][1], min: LEVELS[i][0], next: LEVELS[i + 1] }; };

function renderHud(bump) {
  const L = levelOf(state.xp);
  const pct = L.next ? (state.xp - L.min) / (L.next[0] - L.min) * 100 : 100;
  $('#hud-lvl-name').textContent = L.name;
  $('#hud-xp').textContent = state.xp + ' XP';
  $('#hud-bar').style.width = pct + '%';
  $('#hud-trophy-count').textContent = state.ach.size;
  $('#tr-level').textContent = L.name;
  $('#tr-bar').style.width = pct + '%';
  $('#tr-next').textContent = L.next ? `${state.xp} XP · encore ${L.next[0] - state.xp} XP pour « ${L.next[1]} »` : `${state.xp} XP · niveau max atteint, respect.`;
  const st = $('#st-trophies'); if (st) st.textContent = state.ach.size + '/' + ACH.length;
  if (bump) { const el = $('#hud-level'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}
function addXP(n) {
  const before = levelOf(state.xp).i;
  state.xp += n; save(); renderHud(true);
  const after = levelOf(state.xp);
  if (after.i > before) setTimeout(() => levelUp(after.name), 700);
}
function unlock(id) {
  if (state.ach.has(id)) return;
  const a = ACH.find(x => x.id === id); if (!a) return;
  state.ach.add(id); save();
  toast(a.ico, 'Trophée débloqué', a.title, '+' + a.xp + ' XP');
  sound.blip([660, 880, 1320]);
  addXP(a.xp); renderTrophies();
  const tb = $('#hud-trophy'); tb.classList.remove('bump'); void tb.offsetWidth; tb.classList.add('bump');
}
function toast(ico, small, title, sub) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div class="ico">${ico}</div><div><small>${esc(small)}</small><b>${esc(title)}</b><span>${esc(sub || '')}</span></div>`;
  $('#toasts').appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 3600);
}
function levelUp(name) {
  const el = $('#levelup');
  $('#levelup-name').textContent = name;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  sound.blip([523, 659, 784, 1047], .1);
  confetti();
}
function renderTrophies() {
  $('#ach-list').innerHTML = ACH.map(a => {
    const on = state.ach.has(a.id);
    return `<li class="ach ${on ? 'on' : ''}"><span class="ico">${a.ico}</span><div><b>${on ? esc(a.title) : '???'}</b><small>${esc(a.desc)}</small><div class="xp">${on ? '✔ ' : ''}+${a.xp} XP</div></div></li>`;
  }).join('');
}

/* modal trophées */
const modal = $('#trophies');
const openModal = () => { renderTrophies(); modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); };
const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
$('#hud-trophy').addEventListener('click', openModal);
$('#hud-level').addEventListener('click', openModal);
$$('[data-close]', modal).forEach(b => b.addEventListener('click', closeModal));
$('#tr-reset').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!b.dataset.armed) {
    b.dataset.armed = '1'; b.textContent = 'Sûr ? Clique encore pour tout effacer';
    clearTimeout(b._t); b._t = setTimeout(() => { delete b.dataset.armed; b.textContent = 'Remettre à zéro'; }, 4000);
    return;
  }
  delete b.dataset.armed; b.textContent = 'Remettre à zéro';
  state.xp = 0; state.seen.clear(); state.ach.clear(); save(); renderHud(); renderTrophies(); refreshSeen();
  document.body.classList.remove('argentique');
});

/* confetti */
const cf = $('#confetti'), cx = cf.getContext('2d');
let parts = [], cfRun = false;
function confetti() {
  if (reduce) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cf.width = innerWidth * dpr; cf.height = innerHeight * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = ['#ff4d5a', '#f3eeee', '#ff8a92', '#ffd2d5', '#a8132a'];
  for (let i = 0; i < 160; i++) parts.push({
    x: innerWidth / 2, y: innerHeight / 2, vx: (Math.random() - .5) * 18, vy: Math.random() * -16 - 4,
    s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length], life: 1
  });
  if (!cfRun) { cfRun = true; requestAnimationFrame(cfLoop); }
}
function cfLoop() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts.forEach(p => {
    p.vy += .45; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= .006;
    cx.save(); cx.globalAlpha = Math.max(p.life, 0); cx.translate(p.x, p.y); cx.rotate(p.r);
    cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore();
  });
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
  if (parts.length) requestAnimationFrame(cfLoop); else { cfRun = false; cx.clearRect(0, 0, innerWidth, innerHeight); }
}

/* ================= SCROLL ================= */
const scrollFx = [];
let scrollQueued = false;
const runScroll = () => {
  scrollQueued = false;
  const bar = $('#scroll-prog'), max = document.documentElement.scrollHeight - innerHeight;
  if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  scrollFx.forEach(f => { try { f(); } catch (e) { console.error(e); } });
};
const queueScroll = () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(runScroll); } };
addEventListener('scroll', queueScroll, { passive: true });
addEventListener('resize', queueScroll);

/* ================= FLASH ================= */
const flashEl = $('#flash');
function flash() { flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); sound.shutter(); }

/* ================= ÉCRAN DE CHARGEMENT ================= */
function runLoader() {
  const loader = $('#loader');
  const ready = () => {
    document.body.classList.remove('is-loading');
    requestAnimationFrame(() => document.body.classList.add('ready'));
    startHero();
  };
  if (!loader) { ready(); return; }
  let again = false;
  try { again = sessionStorage.getItem('yl:loaded') === '1'; sessionStorage.setItem('yl:loaded', '1'); } catch (e) {}
  const yr = $('#ld-year'); if (yr) yr.textContent = new Date().getFullYear();
  const srcs = heroPics.map(p => p.src);
  let done = 0; const total = srcs.length + 1;
  srcs.forEach(src => { const im = new Image(); im.onload = im.onerror = () => done++; im.src = src; });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => done++, () => done++);
  const STATUS = ['Développement de la pellicule…', 'Révélateur, fixateur…', 'Séchage des tirages…', 'Mise au point…', 'Prêt.'];
  const minT = reduce ? 0 : again ? 450 : 2300, maxT = 4500, t0 = performance.now();
  const countEl = $('#ld-count'), barEl = $('#ld-bar'), fillEl = $('#ld-fill'), stEl = $('#ld-status');
  let shown = 0, finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    clearTimeout(window.__ylFailsafe);
    loader.classList.add('open');
    flash(); ready();
    setTimeout(() => loader.remove(), 1400);
  };
  const tick = now => {
    const el = now - t0;
    const real = el > maxT ? 1 : done / total;
    const target = Math.min(real, minT ? el / minT : 1);
    shown += (target - shown) * (reduce ? 1 : .14);
    if (target >= 1 && shown > .995) shown = 1;
    const pct = Math.round(shown * 100);
    countEl.textContent = pad(pct, 3);
    barEl.style.width = pct + '%';
    fillEl.style.clipPath = `inset(${100 - pct}% 0 0 0)`;
    stEl.textContent = STATUS[Math.min(STATUS.length - 1, Math.floor(shown * (STATUS.length - 1) + .001))];
    if (shown >= 1) setTimeout(finish, reduce ? 0 : 280); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ================= CURSEUR VISEUR ================= */
const cur = $('#cursor');
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
if (fine && !reduce) {
  document.body.classList.add('has-cursor');
  const pos = { x: mouse.x, y: mouse.y };
  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('[data-cursor]');
    cur.classList.remove('is-photo', 'is-lock', 'is-link');
    const lab = $('.c-label', cur);
    if (!t) return;
    const k = t.dataset.cursor;
    cur.classList.add('is-' + k);
    lab.textContent = k === 'photo' ? 'AF ● focus' : k === 'lock' ? 'en développement' : '';
  });
  const loop = () => {
    pos.x += (mouse.x - pos.x) * .22; pos.y += (mouse.y - pos.y) * .22;
    const w = cur.offsetWidth;
    cur.style.transform = `translate(${pos.x - w / 2}px, ${pos.y - w / 2}px)`;
    requestAnimationFrame(loop);
  };
  loop();
}

if (HOME) {
/* ================= HERO ================= */
$$('[data-split]').forEach((el, li) => {
  el.innerHTML = [...el.textContent].map((c, i) => `<span class="ch" style="--i:${i + li * 5}">${esc(c)}</span>`).join('');
});
const hero = $('#hero');
const SPEEDS = ['1/8000', '1/4000', '1/2000', '1/1000', '1/500', '1/250', '1/125', '1/60'];
const APS = ['F1.4', 'F1.8', 'F2', 'F2.8', 'F4', 'F5.6', 'F8', 'F11'];
let shots = 36, burst = [];
hero.addEventListener('pointermove', e => {
  const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  $('#vf-shutter').textContent = SPEEDS[Math.min(7, Math.floor(x * 8))];
  $('#vf-ap').textContent = APS[Math.min(7, Math.floor(y * 8))];
  $('#vf-iso').textContent = 'ISO ' + [100, 200, 400, 800, 1600, 3200, 6400][Math.min(6, Math.floor((x + y) / 2 * 7))];
  const f = $('#vf-focus');
  f.style.transform = `translate(${(x - .5) * r.width * .6}px, ${(y - .5) * r.height * .5}px)`;
  f.classList.add('lock'); clearTimeout(f._t); f._t = setTimeout(() => f.classList.remove('lock'), 600);
  if (!reduce) $$('.hero-name .line', hero).forEach((l, i) => { l.style.transform = `translate(${(x - .5) * (i ? -24 : 24)}px, 0)`; });
});
hero.addEventListener('click', e => {
  if (e.target.closest('a,button')) return;
  flash();
  shots = shots > 1 ? shots - 1 : 36;
  $('#vf-shots').textContent = pad(shots, 3);
  if (shots === 36) toast('🎞️', 'Pellicule pleine', 'Rembobinage…', 'Nouvelle pellicule de 36 poses');
  const now = performance.now();
  burst = burst.filter(t => now - t < 4000); burst.push(now);
  if (burst.length >= 10) unlock('burst');
});
/* diaporama plein écran */
(() => {
  const box = $('#hero-slides'), bars = $('#hero-bars');
  if (!box || !heroPics.length) return;
  box.innerHTML = heroPics.map(p => `<div class="hslide" style="background-image:url('${encodeURI(p.src)}');background-position:${esc(p.focus || '50% 40%')}"></div>`).join('');
  bars.innerHTML = heroPics.map((_, i) => `<button class="hb" data-i="${i}" data-cursor="link" aria-label="Photo ${i + 1}"><i></i></button>`).join('');
  $('#hero-total').textContent = pad(heroPics.length);
  const DUR = 5500, seenSlides = new Set();
  let cur = -1, timer = 0;
  const show = i => {
    const sl = $$('.hslide', box), prev = cur;
    cur = (i + sl.length) % sl.length;
    sl.forEach((s, k) => { s.classList.toggle('on', k === cur); s.classList.toggle('prev', k === prev && prev !== cur); });
    $$('.hb', bars).forEach((b, k) => { b.classList.toggle('done', k < cur); b.classList.remove('run'); if (k === cur) { void b.offsetWidth; b.classList.add('run'); } });
    $('#hero-idx').textContent = pad(cur + 1);
    seenSlides.add(cur);
    if (seenSlides.size === sl.length && sl.length > 1) unlock('slideshow');
    clearTimeout(timer);
    if (!reduce && sl.length > 1) timer = setTimeout(() => show(cur + 1), DUR);
  };
  bars.addEventListener('click', e => { const b = e.target.closest('.hb'); if (b) { e.stopPropagation(); show(+b.dataset.i); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && cur >= 0) show(cur); });
  startHero = () => { if (cur < 0) show(0); };
})();

/* sélection : défilement horizontal piloté par le scroll */
(() => {
  const sec = $('#selection'), track = $('#hs-track');
  if (!sec || !track) return;
  // alterne les thèmes pour mélanger sport et paysages
  const lists = galleries.map(g => g.photos.map((p, i) => ({ g, p, i }))).filter(l => l.length);
  const items = [];
  for (let k = 0; lists.some(l => l.length); k++) { const l = lists[k % lists.length]; if (l.length) items.push(l.shift()); }
  if (!items.length) { sec.remove(); return; }
  track.innerHTML = items.map(({ g, p, i }, k) => `
    <figure class="hs-item shot" style="--r:${+p.ratio || 2 / 3}" data-g="${g.id}" data-i="${i}" data-cursor="photo" tabindex="0" role="button" aria-label="Ouvrir la photo ${k + 1}">
      <div class="frame"><img src="${esc(p.src)}" alt="${esc(p.alt || g.title + ' ' + (k + 1))}" loading="lazy" decoding="async"></div>
      <figcaption><span class="fr">${pad(k + 1)}</span><span>${esc(g.title)}</span></figcaption>
    </figure>`).join('');
  $('#hs-total').textContent = pad(items.length);
  $$('.hs-item', track).forEach(el => {
    el.addEventListener('click', () => openLB(el.dataset.g, +el.dataset.i));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLB(el.dataset.g, +el.dataset.i); } });
  });
  const imgs = $$('img', track), figs = $$('.hs-item', track);
  let span = 0, last = 0, vel = 0;
  const size = () => {
    span = Math.max(0, track.scrollWidth - innerWidth);
    sec.style.height = (span + innerHeight) + 'px';
  };
  size(); addEventListener('resize', size);
  scrollFx.push(() => {
    const r = sec.getBoundingClientRect(), total = sec.offsetHeight - innerHeight;
    if (r.bottom < 0 || r.top > innerHeight) return;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    const x = -p * span;
    vel += ((x - last) - vel) * .2; last = x;
    track.style.transform = `translate3d(${x}px,0,0) skewX(${reduce ? 0 : Math.max(-6, Math.min(6, vel * .06))}deg)`;
    $('#hs-bar').style.width = p * 100 + '%';
    $('#hs-idx').textContent = pad(Math.min(items.length, Math.round(p * (items.length - 1)) + 1));
    if (p > .985) unlock('selection');
    if (!reduce) figs.forEach((f, k) => {
      const b = f.getBoundingClientRect(), off = ((b.left + b.width / 2) - innerWidth / 2) / innerWidth;
      imgs[k].style.transform = `translate3d(${-off * 10}%,0,0) scale(1.18)`;
    });
  });
})();

/* titres : l'accueil s'efface en parallaxe au scroll */
(() => {
  const slides = $('#hero-slides'), inner = $('#hero-inner'), name = $('.hero-name'), side = $('.hero-side'), dim = $('#hero-dim');
  if (!slides || reduce) return;
  scrollFx.push(() => {
    const vh = innerHeight, p = Math.min(scrollY / vh, 1.2);
    if (p > 1.15) return;
    slides.style.transform = `translate3d(0,${p * vh * .3}px,0) scale(${1 + p * .15})`;
    if (dim) dim.style.opacity = Math.min(.6, p * .55);
    inner.style.transform = `translate3d(0,${-p * vh * .22}px,0)`;
    inner.style.opacity = Math.max(0, 1 - p * 1.4);
    name.style.letterSpacing = (-.02 + p * .12) + 'em';
    if (side) side.style.opacity = Math.max(0, 1 - p * 2);
  });
})();

/* ================= MARQUEE ================= */
(() => {
  const words = ['Sport', 'Portrait', 'Concerts', 'Paysages', 'Mouvement', 'Lumière'];
  const html = words.map(w => `<span>${w} ·</span>`).join('');
  const tr = $('#marquee'); tr.innerHTML = html + html + html;
  let x = 0, lastY = scrollY, vel = 0;
  const loop = () => {
    const dy = scrollY - lastY; lastY = scrollY;
    vel += (dy - vel) * .1;
    x -= (reduce ? 0 : 0.6) + Math.abs(vel) * .35;
    const w = tr.scrollWidth / 3;
    if (-x > w) x += w;
    tr.style.transform = `translateX(${x}px) skewX(${Math.max(-12, Math.min(12, -vel * .4))}deg)`;
    requestAnimationFrame(loop);
  };
  loop();
})();

}

/* ================= PELLICULES ================= */
const phArt = (g, extra = '') => `<div class="ph-art" style="--g:${g.accent};${extra}"></div>`;
function seenCount(g) { return g.items.filter(it => state.seen.has(it.id)).length; }
function renderRolls() {
  $('#rolls').innerHTML = galleries.map(g => {
    const media = g.photos.length ? `<img src="${esc(g.photos[0].src)}" alt="" loading="lazy">` : phArt(g);
    const n = g.items.length, s = seenCount(g);
    const foot = g.unlocked
      ? `<div class="roll-foot"><span>${n} pose${n > 1 ? 's' : ''}</span><span class="roll-prog">vu <span data-rp>${s}/${n}</span><span class="hud-bar"><i data-rpbar style="width:${n ? s / n * 100 : 0}%"></i></span></span></div>`
      : `<div class="dev">Révélateur en cours…<i class="dev-bar"></i></div>`;
    const tag = g.unlocked ? `a href="galerie.html#${g.id}"` : 'button type="button"';
    const current = !HOME && g.id === currentId() ? ' is-current' : '';
    return `<${tag} class="roll reveal${current} ${g.unlocked ? '' : 'is-locked'}" style="--g:${g.accent}" data-id="${g.id}" data-cursor="${g.unlocked ? 'link' : 'lock'}">
      <div class="roll-media">${media}</div>
      <div class="roll-top"><span>Pellicule ${g.roll}</span><span class="roll-status">${g.unlocked ? 'Ouverte' : '<span class="lock-ico">🔒</span> Bientôt'}</span></div>
      <span class="roll-num" aria-hidden="true">${g.roll}</span>
      <div><h3 class="roll-title">${esc(g.title)}</h3><p class="roll-kicker">${esc(g.kicker)}</p>${foot}</div>
    </${g.unlocked ? 'a' : 'button'}>`;
  }).join('');
  $$('.roll').forEach(el => {
    const g = galleries.find(x => x.id === el.dataset.id);
    el.addEventListener('click', e => {
      if (g.unlocked) { if (!e.metaKey && !e.ctrlKey) flash(); return; }
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      toast('🔒', 'Pellicule ' + g.roll, g.title + ' : en développement', 'Revient très bientôt');
      unlock('curious');
    });
    if (fine && !reduce) {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ry', (x - .5) * 14 + 'deg'); el.style.setProperty('--rx', (.5 - y) * 12 + 'deg');
        el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); });
    }
  });
}

/* ================= GALERIES ================= */
function currentId() {
  const h = decodeURIComponent(location.hash.slice(1));
  const g = galleries.find(x => x.id === h && x.unlocked) || galleries.find(x => x.unlocked);
  return g && g.id;
}
// nombre de colonnes (desktop) qui laisse le moins de cases vides, une photo horizontale comptant pour deux
function bestCols(items) {
  const units = items.reduce((a, it) => a + ((it.ratio || 0) > 1.1 ? 2 : 1), 0);
  return [5, 4, 3].reduce((best, c) => ((c - units % c) % c) < ((best - units % best) % best) ? c : best, 5);
}
function renderGalleries() {
  const box = $('#gallery-sections'); if (!box) return;
  const id = currentId();
  const g0 = galleries.find(x => x.id === id);
  if (g0) { document.title = `${g0.title} — ${S.name}`; setTimeout(() => unlock('gallery'), 1200); }
  box.innerHTML = galleries.filter(g => g.id === id).map(g => {
    const empty = !g.photos.length;
    return `<section class="gal gal-page" id="g-${g.id}" style="--g:${g.accent}">
      <a class="back" href="index.html" data-cursor="link">← Toutes les pellicules</a>
      <header class="gal-head reveal">
        <div>
          <span class="gal-roll">Pellicule ${g.roll} — ${esc(g.kicker)}</span>
          <h2 class="gal-title">${esc(g.title)}</h2>
          <p class="gal-intro">${esc(g.intro)}</p>
        </div>
        <div class="gal-progress">Collection<b data-prog="${g.id}">0/${g.items.length}</b><span class="hud-bar"><i data-progbar="${g.id}"></i></span></div>
      </header>
      ${empty ? `<p class="gal-empty-note">↳ Cadres d'exemple — dépose tes photos dans <code>photos/${g.id}/</code> puis lance <code>python3 generer-galeries.py</code>.</p>` : ''}
      <div class="grid" style="--cols:${bestCols(g.items)}">
        ${g.items.map((it, i) => `
          <figure class="shot${(it.ratio || 0) > 1.1 ? ' wide' : ''}" data-g="${g.id}" data-i="${i}" data-cursor="photo" style="--d:${(i % 3) * .12}s" tabindex="0" role="button" aria-label="Ouvrir la photo ${it.n}">
            <div class="frame">${it.placeholder
              ? `<div class="ph-art" style="--g:${g.accent};aspect-ratio:${it.ratio}"><div class="ph-label"><span>Photo à venir</span><b>${pad(it.n)}</b></div></div>`
              : `<img src="${esc(it.src)}" alt="${esc(it.alt || it.caption || g.title + ' ' + it.n)}" loading="lazy" decoding="async">`}</div>
            <figcaption><span class="fr">▸ ${pad(it.n)}A</span>${it.caption ? `<span>${esc(it.caption)}</span>` : ''}<span class="seen-tag">✓ vu</span></figcaption>
          </figure>`).join('')}
      </div>
    </section>`;
  }).join('');
  $$('.shot').forEach(el => {
    el.addEventListener('click', () => openLB(el.dataset.g, +el.dataset.i));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLB(el.dataset.g, +el.dataset.i); } });
  });
  refreshSeen();
}
function refreshSeen() {
  galleries.filter(g => g.unlocked).forEach(g => {
    const s = seenCount(g), n = g.items.length;
    const b = $(`[data-prog="${g.id}"]`), bar = $(`[data-progbar="${g.id}"]`);
    if (b) b.textContent = s + '/' + n;
    if (bar) bar.style.width = (n ? s / n * 100 : 0) + '%';
  });
  $$('.shot').forEach(el => {
    const g = galleries.find(x => x.id === el.dataset.g);
    el.classList.toggle('seen', state.seen.has(g.items[+el.dataset.i].id));
  });
  $$('.roll').forEach(el => {
    const g = galleries.find(x => x.id === el.dataset.id), s = seenCount(g), n = g.items.length;
    const t = $('[data-rp]', el), b = $('[data-rpbar]', el);
    if (t) t.textContent = s + '/' + n;
    if (b) b.style.width = (n ? s / n * 100 : 0) + '%';
  });
}

/* ================= LIGHTBOX ================= */
const lb = $('#lb'), stage = $('#lb-stage');
let cur$ = null; // {g, i}
function fitBox(ratio) {
  const mw = innerWidth * (innerWidth < 640 ? .94 : .82), mh = innerHeight * .74;
  let w = mw, h = w / ratio; if (h > mh) { h = mh; w = h * ratio; }
  return { w, h, x: (innerWidth - w) / 2, y: (innerHeight - h) / 2 - 6 };
}
function itemRatio(it, thumb) {
  if (thumb) { const r = thumb.getBoundingClientRect(); if (r.width && r.height) return r.width / r.height; }
  if (it.placeholder) { const [a, b] = it.ratio.split('/').map(Number); return a / b; }
  return 3 / 2;
}
function fillStage(g, it) {
  stage.innerHTML = it.placeholder
    ? `<div class="ph-art" style="--g:${g.accent}"><div class="ph-label"><span>${esc(g.title)} — photo à venir</span><b>${pad(it.n)}</b></div></div>`
    : `<img src="${esc(it.src)}" alt="${esc(it.alt || it.caption || '')}">`;
  $('#lb-count').textContent = `${g.title} · ${pad(it.n)} / ${pad(g.items.length)}`;
  $('#lb-caption').textContent = it.caption || (it.placeholder ? 'Cadre en attente de sa photo' : '');
  $('#lb-exif').textContent = it.exif || '';
}
function markSeen(g, it) {
  if (state.seen.has(it.id)) return;
  state.seen.add(it.id); save();
  addXP(10);
  unlock('first-shot');
  if (g.items.every(x => state.seen.has(x.id))) { unlock('full-roll'); }
  refreshSeen();
}
function thumbOf(gid, i) { return $(`.shot[data-g="${gid}"][data-i="${i}"] .frame`); }
function openLB(gid, i) {
  const g = galleries.find(x => x.id === gid), it = g.items[i];
  cur$ = { g, i };
  const thumb = thumbOf(gid, i), box = fitBox(itemRatio(it, thumb));
  fillStage(g, it);
  Object.assign(stage.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
  lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  flash();
  if (thumb && !reduce) {
    const r = thumb.getBoundingClientRect();
    stage.animate([
      { transform: `translate(${r.left - box.x}px, ${r.top - box.y}px) scale(${r.width / box.w}, ${r.height / box.h})` },
      { transform: 'none' }
    ], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
  markSeen(g, it);
  $('#lb-close').focus({ preventScroll: true });
}
function navLB(d) {
  if (!cur$) return;
  const { g } = cur$, n = g.items.length, i = (cur$.i + d + n) % n, it = g.items[i];
  cur$.i = i;
  const box = fitBox(itemRatio(it, thumbOf(g.id, i)));
  const go = () => {
    fillStage(g, it);
    Object.assign(stage.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
    if (!reduce) stage.animate([{ opacity: 0, transform: `translateX(${d * 60}px)` }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' });
  };
  if (reduce) go(); else stage.animate([{ opacity: 1 }, { opacity: 0, transform: `translateX(${-d * 60}px)` }], { duration: 180 }).onfinish = go;
  sound.shutter();
  markSeen(g, it);
}
function closeLB() {
  if (!cur$) return;
  const thumb = thumbOf(cur$.g.id, cur$.i);
  const done = () => { lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; stage.innerHTML = ''; };
  if (thumb && !reduce) {
    const r = thumb.getBoundingClientRect(), s = stage.getBoundingClientRect();
    $('.lb-bg', lb).style.opacity = 0;
    stage.animate([{ transform: 'none' }, { transform: `translate(${r.left - s.left}px, ${r.top - s.top}px) scale(${r.width / s.width}, ${r.height / s.height})` }],
      { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => { $('.lb-bg', lb).style.opacity = ''; done(); };
  } else done();
  const f = $(`.shot[data-g="${cur$.g.id}"][data-i="${cur$.i}"]`); cur$ = null;
  if (f) f.focus({ preventScroll: true });
}
$('#lb-close').addEventListener('click', closeLB);
$('.lb-bg', lb).addEventListener('click', closeLB);
$('#lb-prev').addEventListener('click', () => navLB(-1));
$('#lb-next').addEventListener('click', () => navLB(1));
(() => { // swipe
  let sx = null;
  stage.addEventListener('pointerdown', e => { sx = e.clientX; });
  stage.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) navLB(dx < 0 ? 1 : -1); });
})();
addEventListener('resize', () => {
  if (!cur$) return;
  const it = cur$.g.items[cur$.i], box = fitBox(itemRatio(it, thumbOf(cur$.g.id, cur$.i)));
  Object.assign(stage.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
});

/* ================= CLAVIER + KONAMI ================= */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let kseq = [];
addEventListener('keydown', e => {
  if (cur$) {
    if (e.key === 'Escape') closeLB();
    if (e.key === 'ArrowRight') navLB(1);
    if (e.key === 'ArrowLeft') navLB(-1);
  } else if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  kseq.push(e.key.length === 1 ? e.key.toLowerCase() : e.key); kseq = kseq.slice(-KONAMI.length);
  if (kseq.join() === KONAMI.join()) {
    kseq = [];
    const on = document.body.classList.toggle('argentique');
    flash();
    toast('🎞️', 'Code secret', on ? 'Mode argentique activé' : 'Retour à la couleur', on ? 'Tri-X 400, grain poussé' : '');
    unlock('konami');
  }
});

if (HOME) {
/* ================= ABOUT / CONTACT ================= */
$('#about-text').innerHTML = (S.about || []).map(p => `<p>${esc(p).split(/(\s+)/).map(w => /^\s+$/.test(w) || !w ? w : `<span class="aw">${w}</span>`).join('')}</p>`).join('');
const words = $$('#about-text .aw');
scrollFx.push(() => {
  const lim = innerHeight * .72;
  words.forEach(w => w.classList.toggle('lit', w.getBoundingClientRect().top < lim));
});
(() => {
  const fig = $('#contact-photo'), img = $('#contact-img');
  if (!fig) return;
  if (!S.contactPhoto) { fig.remove(); $('.contact-wrap').classList.add('no-photo'); return; }
  if (img.getAttribute('src') !== S.contactPhoto) img.src = S.contactPhoto;
  fig.classList.add('reveal');
  if (!reduce) scrollFx.push(() => {
    const r = fig.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    img.style.transform = `translate3d(0,${p * -8}%,0) scale(1.14)`;
  });
  fig.addEventListener('click', () => { flash(); fig.classList.remove('snap'); void fig.offsetWidth; fig.classList.add('snap'); });
})();
if (S.aboutPhoto) { const a = $('#about-photo'); a.style.backgroundImage = `url('${encodeURI(S.aboutPhoto)}')`; a.innerHTML = ''; }
$('#st-photos').dataset.count = totalPhotos;
$('#st-rolls').dataset.count = galleries.length;
$('#polaroid').addEventListener('click', () => { flash(); const p = $('#polaroid'); p.style.transform = `rotate(${(Math.random() * 10 - 5).toFixed(1)}deg)`; });

(() => {
  const box = $('#contact-actions'), btns = [];
  if (S.email) btns.push(`<a class="btn magnet" data-cursor="link" data-contact href="mailto:${esc(S.email)}">✉ ${esc(S.email)}</a>`);
  if (S.instagram) btns.push(`<a class="btn ghost magnet" data-cursor="link" data-contact href="https://instagram.com/${encodeURIComponent(S.instagram)}" target="_blank" rel="noopener">Instagram @${esc(S.instagram)}</a>`);
  if (!btns.length) btns.push(`<span class="btn ghost" title="Ajoute ton email / Instagram dans config.js">✉ Contact — à configurer dans config.js</span>`);
  box.innerHTML = btns.join('');
  $$('[data-contact]', box).forEach(a => a.addEventListener('click', () => unlock('contact')));
  if (fine && !reduce) $$('.magnet', box).forEach(m => {
    m.addEventListener('pointermove', e => { const r = m.getBoundingClientRect(); m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .3}px, ${(e.clientY - r.top - r.height / 2) * .4}px)`; });
    m.addEventListener('pointerleave', () => { m.style.transform = ''; });
  });
})();
}
$$('[data-split-words]').forEach(el => {
  let i = 0;
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(w => {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.append(w); return; }
        const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = w; frag.append(s);
      });
      n.replaceWith(frag);
    } else walk(n);
  });
  walk(el);
});
$('#year').textContent = new Date().getFullYear();

/* ballon caché */
$('#hidden-ball').addEventListener('click', e => {
  e.currentTarget.classList.add('found');
  sound.blip([392, 523, 659]);
  unlock('hidden-ball');
});

/* ================= REVEAL / OBSERVERS ================= */
const counted = new WeakSet();
function countUp(el) {
  if (counted.has(el)) return; counted.add(el);
  const to = +el.dataset.count || 0, t0 = performance.now(), d = 1400;
  const step = now => { const t = Math.min((now - t0) / d, 1); el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3))); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const io = new IntersectionObserver(entries => entries.forEach(en => {
  if (!en.isIntersecting) return;
  const el = en.target;
  el.classList.add('in');
  if (el.dataset.count != null) countUp(el);
  if (el.id === 'contact') unlock('explorer');
  io.unobserve(el);
}), { threshold: .12, rootMargin: '0px 0px -5% 0px' });
function observe() {
  $$('.reveal:not(.in), .shot:not(.in), [data-count], .contact-title:not(.in)').forEach(el => io.observe(el));
}
const ioEnd = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { unlock('explorer'); ioEnd.disconnect(); } }), { threshold: .5 });
ioEnd.observe($('.foot'));
$$('.sec-head, .about-grid, .contact-sub, .contact-actions').forEach(el => el.classList.add('reveal'));

// filet de sécurité : tout reste visible même si l'observer ne se déclenche pas (aperçus, miniatures)
setTimeout(() => $$('.reveal:not(.in), .shot:not(.in), .contact-title:not(.in)').forEach(el => {
  const r = el.getBoundingClientRect();
  if (r.top < innerHeight && r.bottom > 0) el.classList.add('in');
}), 2500);

addEventListener('scroll', () => $('.nav').classList.toggle('scrolled', scrollY > 40), { passive: true });

/* ================= INIT ================= */
if ($('#rolls')) renderRolls();
renderGalleries();
observe();
addEventListener('hashchange', () => {
  renderGalleries();
  if ($('#rolls')) renderRolls();
  observe(); scrollTo(0, 0);
});
renderHud(); renderTrophies();
runLoader();
queueScroll();

window.YL = { unlock, addXP, sound, toast, flash };
})();
