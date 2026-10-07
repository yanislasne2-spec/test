/* Instant décisif : mini-jeu photo. Vise avec le cadre, déclenche au bon moment. */
(() => {
'use strict';
const wrap = document.getElementById('game');
const cvs = document.getElementById('game-canvas');
const ctx = cvs.getContext('2d');
const scene = document.createElement('canvas');
const sx = scene.getContext('2d');
const $ = id => document.getElementById(id);
const YL = window.YL || { unlock() {}, addXP() {}, sound: { blip() {}, shutter() {} } };
const store = {
  get(k, d) { try { const v = localStorage.getItem('yl:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('yl:' + k, JSON.stringify(v)); } catch (e) {} }
};
const SHOTS = 12, TIME = 30;

let W = 0, H = 0, DPR = 1, FW = 120, FH = 90;
const aim = { x: 0, y: 0, tx: 0, ty: 0 };
const game = { state: 'menu', score: 0, clock: TIME, shots: SHOTS, streak: 0, peaks: 0, best: store.get('best-shot', 0) };
let subjects = [], flash = 0, time = 0, visible = false, running = false;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = wrap.clientWidth; H = wrap.clientHeight;
  for (const c of [cvs, scene]) { c.width = W * DPR; c.height = H * DPR; }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); sx.setTransform(DPR, 0, 0, DPR, 0, 0);
  FH = Math.max(64, Math.min(110, Math.min(W, H) * .2)); FW = FH * 4 / 3;
  if (!aim.x) { aim.x = aim.tx = W / 2; aim.y = aim.ty = H / 2; }
  if (!subjects.length) subjects = Array.from({ length: 3 }, () => spawn());
  draw();
}
function spawn() {
  const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 70;
  return {
    x: W * (.15 + Math.random() * .7), y: H * (.25 + Math.random() * .6), a, sp, r: 12 + Math.random() * 10,
    peak: 0, next: 1.2 + Math.random() * 3.5, born: time
  };
}

/* ---------- entrées ---------- */
const local = e => { const r = cvs.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
cvs.addEventListener('pointermove', e => { const p = local(e); aim.tx = p.x; aim.ty = p.y; });
cvs.addEventListener('pointerenter', () => document.body.classList.add('in-game'));
cvs.addEventListener('pointerleave', () => document.body.classList.remove('in-game'));
cvs.addEventListener('pointerdown', e => {
  if (game.state !== 'ready' && game.state !== 'play') return;
  e.preventDefault();
  const p = local(e);
  if (e.pointerType !== 'mouse') { aim.x = aim.tx = p.x; aim.y = aim.ty = p.y; }
  shoot();
});

/* ---------- déclenchement ---------- */
function shoot() {
  if (game.state === 'ready') game.state = 'play';
  game.shots--;
  flash = 1;
  YL.sound.shutter();
  const fx = aim.x - FW / 2, fy = aim.y - FH / 2;
  let best = null, bestC = -1;
  subjects.forEach(s => {
    if (s.x < fx || s.x > fx + FW || s.y < fy || s.y > fy + FH) return;
    const c = 1 - Math.hypot((s.x - aim.x) / (FW / 2), (s.y - aim.y) / (FH / 2)) / Math.SQRT2;
    if (c > bestC) { bestC = c; best = s; }
  });
  let label, pts = 0, kind = '';
  if (best) {
    pts = Math.round(10 + 40 * Math.max(0, bestC));
    const peak = best.peak > 0;
    if (peak) { pts *= 3; game.peaks++; kind = 'peak'; YL.unlock('decisive'); }
    else kind = 'hit';
    if (bestC > .88) YL.unlock('centered');
    label = peak ? `Instant décisif +${pts}` : bestC > .88 ? `Pile au centre +${pts}` : `+${pts}`;
    game.score += pts; game.streak++;
    if (game.streak >= 4) YL.unlock('streak');
    if (game.score >= 300) YL.unlock('pro-roll');
    YL.addXP(peak ? 4 : 2);
    YL.sound.blip(peak ? [660, 880, 1320] : [660, 880], .07);
  } else {
    label = 'Raté'; game.streak = 0;
    YL.sound.blip([200], .06);
  }
  thumb(fx, fy, kind, pts);
  pop(label, kind === 'peak');
  if (best) Object.assign(best, spawn());
  hud();
  if (game.shots <= 0) setTimeout(gameOver, 450);
}
function thumb(fx, fy, kind, pts) {
  const t = document.createElement('canvas'); t.width = 144; t.height = 108;
  const c = t.getContext('2d');
  c.fillStyle = '#0a0909'; c.fillRect(0, 0, 144, 108);
  c.drawImage(scene, fx * DPR, fy * DPR, FW * DPR, FH * DPR, 0, 0, 144, 108);
  const f = document.createElement('figure');
  if (kind) f.className = kind;
  f.append(t);
  const cap = document.createElement('figcaption'); cap.textContent = kind ? '+' + pts : '✕'; f.append(cap);
  const strip = $('g-strip'); strip.append(f); strip.scrollLeft = strip.scrollWidth;
}

/* ---------- HUD / états ---------- */
const pad = (n, l = 3) => String(n).padStart(l, '0');
function hud() {
  $('g-score').textContent = pad(game.score);
  $('g-best').textContent = pad(Math.max(game.best, game.score));
  $('g-shots').textContent = String(Math.max(0, game.shots)).padStart(2, '0');
  const c = Math.max(0, game.clock);
  $('g-clock').textContent = c < 5 ? c.toFixed(1) : Math.ceil(c);
  $('g-clock').parentElement.classList.toggle('low', c < 5 && game.state === 'play');
}
function pop(text, big) {
  const el = $('g-pop');
  el.textContent = text; el.style.left = aim.x + 'px'; el.style.top = (aim.y - FH / 2 - 18) + 'px';
  el.style.fontSize = big ? '' : '18px';
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}
function overlay(show, title, text, btn) {
  $('g-overlay').classList.toggle('hide', !show);
  if (title) $('g-title').textContent = title;
  if (text != null) $('g-text').innerHTML = text;
  if (btn) $('g-start').textContent = btn;
}
function startGame() {
  Object.assign(game, { state: 'ready', score: 0, clock: TIME, shots: SHOTS, streak: 0, peaks: 0 });
  subjects = Array.from({ length: 3 }, () => spawn());
  $('g-strip').innerHTML = '';
  hud(); overlay(false);
}
function gameOver() {
  if (game.state === 'over') return;
  game.state = 'over';
  const record = game.score > game.best;
  if (record) { game.best = game.score; store.set('best-shot', game.best); }
  hud();
  overlay(true, record && game.score > 0 ? 'Nouveau record' : 'Pellicule terminée',
    `<b>${game.score}</b> points · ${game.peaks} instant${game.peaks > 1 ? 's' : ''} décisif${game.peaks > 1 ? 's' : ''}. Record : <b>${game.best}</b>.<br>Ta planche contact est juste en dessous.`, 'Nouvelle pellicule');
  YL.sound.blip([392, 330, 262], .14);
}
$('g-start').addEventListener('click', startGame);

/* ---------- simulation ---------- */
function step(dt) {
  aim.x += (aim.tx - aim.x) * Math.min(1, dt * 14); aim.y += (aim.ty - aim.y) * Math.min(1, dt * 14);
  flash = Math.max(0, flash - dt * 4);
  const speedUp = game.state === 'play' ? 1 + (TIME - game.clock) / TIME * .9 : .6;
  subjects.forEach(s => {
    s.a += (Math.random() - .5) * 3 * dt;
    s.x += Math.cos(s.a) * s.sp * speedUp * dt; s.y += Math.sin(s.a) * s.sp * speedUp * dt;
    const m = s.r + 8;
    if (s.x < m || s.x > W - m) { s.a = Math.PI - s.a; s.x = Math.max(m, Math.min(W - m, s.x)); }
    if (s.y < 70 || s.y > H - m) { s.a = -s.a; s.y = Math.max(70, Math.min(H - m, s.y)); }
    if (s.peak > 0) { s.peak -= dt; if (s.peak <= 0) s.next = 1.5 + Math.random() * 3.5; }
    else if ((s.next -= dt) <= 0) s.peak = .85;
  });
}

/* ---------- rendu ---------- */
function drawScene() {
  sx.fillStyle = '#0a0909'; sx.fillRect(0, 0, W, H);
  const g = sx.createRadialGradient(W / 2, H * .2, 10, W / 2, H * .2, H);
  g.addColorStop(0, 'rgba(255,77,90,.10)'); g.addColorStop(1, 'rgba(255,77,90,0)');
  sx.fillStyle = g; sx.fillRect(0, 0, W, H);
  sx.fillStyle = 'rgba(243,238,238,.06)';
  for (let y = 12; y < H; y += 22) for (let x = 12; x < W; x += 22) sx.fillRect(x, y, 1.2, 1.2);
  subjects.forEach(s => {
    const pk = s.peak > 0, pulse = pk ? 1 + Math.sin(time * 30) * .08 : 1, r = s.r * pulse;
    const halo = sx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * (pk ? 4 : 2.6));
    halo.addColorStop(0, pk ? 'rgba(255,240,240,.55)' : 'rgba(255,77,90,.32)');
    halo.addColorStop(1, 'rgba(255,77,90,0)');
    sx.fillStyle = halo; sx.beginPath(); sx.arc(s.x, s.y, r * (pk ? 4 : 2.6), 0, Math.PI * 2); sx.fill();
    sx.fillStyle = pk ? '#fff' : '#ff4d5a';
    sx.beginPath(); sx.arc(s.x, s.y, r, 0, Math.PI * 2); sx.fill();
    sx.strokeStyle = pk ? '#ff4d5a' : 'rgba(243,238,238,.5)'; sx.lineWidth = 1.5;
    sx.beginPath(); sx.arc(s.x, s.y, r + 5, 0, Math.PI * 2); sx.stroke();
  });
}
function draw() {
  drawScene();
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(scene, 0, 0, W, H);
  // viseur
  const x = aim.x - FW / 2, y = aim.y - FH / 2, inFrame = subjects.some(s => s.x > x && s.x < x + FW && s.y > y && s.y < y + FH);
  ctx.strokeStyle = inFrame ? '#ff8a92' : 'rgba(243,238,238,.85)'; ctx.lineWidth = 2;
  const k = 14;
  ctx.beginPath();
  ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
  ctx.moveTo(x + FW - k, y); ctx.lineTo(x + FW, y); ctx.lineTo(x + FW, y + k);
  ctx.moveTo(x, y + FH - k); ctx.lineTo(x, y + FH); ctx.lineTo(x + k, y + FH);
  ctx.moveTo(x + FW - k, y + FH); ctx.lineTo(x + FW, y + FH); ctx.lineTo(x + FW, y + FH - k);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(243,238,238,.25)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 3; i++) { ctx.moveTo(x + FW * i / 3, y + 4); ctx.lineTo(x + FW * i / 3, y + FH - 4); ctx.moveTo(x + 4, y + FH * i / 3); ctx.lineTo(x + FW - 4, y + FH * i / 3); }
  ctx.stroke();
  ctx.fillStyle = inFrame ? '#ff4d5a' : 'rgba(243,238,238,.6)';
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.fillText(inFrame ? 'AF ● FOCUS' : 'AF', x, y + FH + 14);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * .7})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------- boucle ---------- */
let last = 0;
function loop(now) {
  if (!visible) { running = false; return; }
  const dt = Math.min((now - last) / 1000 || 0, .033); last = now; time += dt;
  if (game.state === 'play') {
    game.clock -= dt;
    if (game.clock <= 0) { game.clock = 0; gameOver(); }
    hud();
  }
  step(dt); draw();
  requestAnimationFrame(loop);
}
new IntersectionObserver(([en]) => {
  visible = en.isIntersecting;
  if (visible && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
}, { threshold: .15 }).observe(wrap);
new ResizeObserver(resize).observe(wrap);
resize(); hud();
})();
