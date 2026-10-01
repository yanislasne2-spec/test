/* Shootaround : mini-jeu de basket (lance-pierre + physique simple) */
(() => {
'use strict';
const wrap = document.getElementById('game');
const cvs = document.getElementById('game-canvas');
const ctx = cvs.getContext('2d');
const $ = id => document.getElementById(id);
const YL = window.YL || { unlock() {}, addXP() {}, sound: { blip() {}, shutter() {} } };
const store = {
  get(k, d) { try { const v = localStorage.getItem('yl:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('yl:' + k, JSON.stringify(v)); } catch (e) {} }
};

let W = 0, H = 0, G = 0, R = 14, RIM = 26, floorY = 0, maxPull = 140, vmax = 1000;
const ball = { x: 0, y: 0, vx: 0, vy: 0, a: 0, state: 'idle' };
const hoop = { x: 0, y: 0, tx: 0, ty: 0, sway: 0, moving: false, phase: 0, baseX: 0 };
const game = { state: 'menu', score: 0, clock: 24, streak: 0, best: store.get('best', 0) };
let shot = null, drag = null, trail = [], time = 0, running = false, visible = false, placed = false;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = wrap.clientWidth; H = wrap.clientHeight;
  cvs.width = W * dpr; cvs.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  G = H * 3;
  R = Math.max(11, Math.min(17, H * .032));
  RIM = R * 2.1;
  floorY = H - 10;
  maxPull = Math.min(160, H * .32);
  vmax = Math.sqrt(G * Math.max(W * .9, H * 1.4)) * 1.1;
  if (!placed) { hoop.x = hoop.tx = hoop.baseX = W * .76; hoop.y = hoop.ty = H * .4; placed = true; }
  hoop.baseX = hoop.tx = Math.min(hoop.tx, W - RIM - R * 4); hoop.x = hoop.tx;
  if (ball.state !== 'fly') spawn(ball.x ? ball.x / (W || 1) : .18);
  draw();
}
function spawn(fx = .12 + Math.random() * .16) {
  ball.x = Math.max(R * 2, Math.min(W * .4, W * fx)); ball.y = H * .78;
  ball.vx = ball.vy = 0; ball.state = 'idle'; trail = [];
}

/* ---------- entrées ---------- */
function local(e) { const r = cvs.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
cvs.addEventListener('pointerdown', e => {
  if (game.state === 'menu' || game.state === 'over' || ball.state !== 'idle') return;
  const p = local(e);
  const grab = e.pointerType === 'touch' ? R * 5 : R * 3.5;
  if (Math.hypot(p.x - ball.x, p.y - ball.y) > grab) return;
  drag = p; cvs.setPointerCapture(e.pointerId); e.preventDefault();
});
cvs.addEventListener('pointermove', e => { if (drag) drag = local(e); });
const release = () => {
  if (!drag) return;
  let dx = ball.x - drag.x, dy = ball.y - drag.y;
  const len = Math.hypot(dx, dy); drag = null;
  if (len < 12) return;
  const k = Math.min(len, maxPull) / len;
  dx *= k; dy *= k;
  ball.vx = dx / maxPull * vmax; ball.vy = dy / maxPull * vmax;
  ball.state = 'fly';
  shot = { scored: false, touched: false, t: 0 };
  if (game.state === 'ready') game.state = 'play';
  YL.sound.blip([220], .05);
};
cvs.addEventListener('pointerup', release);
cvs.addEventListener('pointercancel', () => { drag = null; });

/* ---------- physique ---------- */
function collidePoint(px, py) {
  const dx = ball.x - px, dy = ball.y - py, d = Math.hypot(dx, dy), min = R + 1.5;
  if (d >= min || d === 0) return;
  const nx = dx / d, ny = dy / d;
  ball.x = px + nx * min; ball.y = py + ny * min;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) { ball.vx -= 1.55 * vn * nx; ball.vy -= 1.55 * vn * ny; if (shot) shot.touched = true; if (Math.abs(vn) > 120) YL.sound.blip([140], .03); }
}
function step(dt) {
  if (hoop.moving) { hoop.phase += dt; hoop.x = hoop.baseX + Math.sin(hoop.phase * 1.3) * W * .07; }
  else { hoop.x += (hoop.tx - hoop.x) * Math.min(1, dt * 5); hoop.y += (hoop.ty - hoop.y) * Math.min(1, dt * 5); }
  hoop.sway *= Math.pow(.05, dt);

  if (ball.state !== 'fly') return;
  const py = ball.y;
  ball.vy += G * dt;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  ball.a += ball.vx * dt / R;

  collidePoint(hoop.x - RIM, hoop.y);
  collidePoint(hoop.x + RIM, hoop.y);
  const bx = hoop.x + RIM + 4, bTop = hoop.y - R * 6.5, bBot = hoop.y + R * 1.2;
  if (ball.y > bTop - R * .5 && ball.y < bBot + R * .5 && ball.x + R > bx && ball.x < bx + 6 && ball.vx > 0) {
    ball.x = bx - R; ball.vx = -ball.vx * .6; if (shot) shot.touched = true; YL.sound.blip([110], .04);
  }
  if (ball.y + R > floorY) {
    ball.y = floorY - R; ball.vy = -ball.vy * .55; ball.vx *= .82;
    if (Math.abs(ball.vy) < 70) ball.vy = 0;
  }
  if (ball.x < R) { ball.x = R; ball.vx = -ball.vx * .6; }

  if (shot && !shot.scored && py <= hoop.y && ball.y > hoop.y && ball.vy > 0 && ball.x > hoop.x - RIM && ball.x < hoop.x + RIM) score();

  shot.t += dt;
  const resting = ball.vy === 0 && Math.abs(ball.vx) < 25 && ball.y + R >= floorY - 1;
  if (resting || ball.x > W + R * 2 || shot.t > 3.6 || (shot.scored && ball.y + R >= floorY - 1 && shot.t > .5)) endShot();
}
function score() {
  shot.scored = true;
  const pts = shot.touched ? 2 : 3;
  game.score += pts; game.streak++;
  hoop.sway = 1;
  pop(shot.touched ? '+2' : 'SWISH +3');
  YL.sound.blip(shot.touched ? [523, 784] : [523, 784, 1047], .08);
  YL.addXP(2);
  YL.unlock('swish');
  if (game.streak >= 3) YL.unlock('on-fire');
  if (game.state === 'buzzer' || game.clock <= 1) YL.unlock('buzzer');
  if (game.score >= 16) YL.unlock('clutch');
  hud();
}
function endShot() {
  const scored = shot && shot.scored;
  if (!scored) { game.streak = 0; }
  ball.state = 'idle'; shot = null;
  if (game.state === 'buzzer') { gameOver(); return; }
  if (scored) {
    hoop.tx = hoop.baseX = W * (.58 + Math.random() * .24);
    hoop.tx = hoop.baseX = Math.min(hoop.tx, W - RIM - R * 4);
    hoop.ty = H * (.26 + Math.random() * .26);
    hoop.moving = game.score >= 10;
    if (hoop.moving) hoop.y = hoop.ty;
  }
  spawn();
  hud();
}

/* ---------- HUD / états ---------- */
const pad = n => String(n).padStart(2, '0');
function hud() {
  $('g-score').textContent = pad(game.score);
  $('g-best').textContent = pad(Math.max(game.best, game.score));
  const c = Math.max(0, game.clock);
  $('g-clock').textContent = c < 5 ? c.toFixed(1) : Math.ceil(c);
  $('g-clock').parentElement.classList.toggle('low', c < 5 && game.state === 'play');
  $('g-streak').textContent = game.streak >= 2 ? '🔥'.repeat(Math.min(game.streak, 5)) : '';
}
function pop(text) {
  const el = $('g-pop');
  el.textContent = text; el.style.left = hoop.x + 'px'; el.style.top = (hoop.y - 50) + 'px';
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}
function overlay(show, title, text, btn) {
  const o = $('g-overlay');
  o.classList.toggle('hide', !show);
  if (title) $('g-title').textContent = title;
  if (text != null) $('g-text').innerHTML = text;
  if (btn) $('g-start').textContent = btn;
}
function startGame() {
  game.state = 'ready'; game.score = 0; game.clock = 24; game.streak = 0;
  hoop.moving = false; hoop.tx = hoop.baseX = W * .76; hoop.ty = H * .4;
  spawn(.18); hud(); overlay(false);
}
function gameOver() {
  game.state = 'over';
  const record = game.score > game.best;
  if (record) { game.best = game.score; store.set('best', game.best); }
  hud();
  overlay(true, record && game.score > 0 ? 'Nouveau record !' : 'Buzzer !',
    `Tu as marqué <b>${game.score}</b> point${game.score > 1 ? 's' : ''}. Record : <b>${game.best}</b>.<br>Swish = 3 pts · arceau/planche = 2 pts.`, 'Rejouer');
  YL.sound.blip([392, 330, 262], .14);
}
$('g-start').addEventListener('click', startGame);

/* ---------- rendu ---------- */
function drawBall(x, y, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  const g = ctx.createRadialGradient(-R * .35, -R * .35, R * .1, 0, 0, R);
  g.addColorStop(0, '#ffa45c'); g.addColorStop(1, '#c2410c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(30,12,4,.75)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.moveTo(0, -R); ctx.lineTo(0, R); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-R * 1.05, 0, R * .55, R * 1.1, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(R * 1.05, 0, R * .55, R * 1.1, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  // projecteurs
  [[.2, '255,180,110'], [.7, '255,120,60']].forEach(([fx, c]) => {
    const g = ctx.createRadialGradient(W * fx, -40, 10, W * fx, -40, H * 1.1);
    g.addColorStop(0, `rgba(${c},.16)`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  // parquet
  ctx.fillStyle = 'rgba(255,140,60,.08)'; ctx.fillRect(0, floorY, W, H - floorY);
  ctx.strokeStyle = 'rgba(255,170,110,.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.stroke();

  const bx = hoop.x + RIM + 4, bTop = hoop.y - R * 6.5, bBot = hoop.y + R * 1.2;
  // poteau
  ctx.strokeStyle = 'rgba(241,235,225,.25)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(bx + R * 2.5, floorY); ctx.lineTo(bx + R * 2.5, hoop.y - R * 2); ctx.lineTo(bx + 4, hoop.y - R * 2); ctx.stroke();
  // planche
  ctx.fillStyle = 'rgba(241,235,225,.9)'; ctx.fillRect(bx, bTop, 6, bBot - bTop);
  ctx.fillStyle = 'rgba(255,90,31,.9)'; ctx.fillRect(bx - 1, hoop.y - R * 2.6, 2, R * 2.2);

  // traînée « on fire »
  if (game.streak >= 3 && ball.state === 'fly') {
    trail.push({ x: ball.x, y: ball.y }); if (trail.length > 18) trail.shift();
    trail.forEach((p, i) => {
      const k = i / trail.length;
      ctx.fillStyle = `rgba(255,${120 + 100 * k | 0},40,${k * .5})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, R * (.4 + .6 * k), 0, Math.PI * 2); ctx.fill();
    });
  }

  // visée
  if (drag && ball.state === 'idle') {
    let dx = ball.x - drag.x, dy = ball.y - drag.y; const len = Math.hypot(dx, dy) || 1, k = Math.min(len, maxPull) / len;
    dx *= k; dy *= k;
    const vx = dx / maxPull * vmax, vy = dy / maxPull * vmax, power = Math.min(len, maxPull) / maxPull;
    ctx.strokeStyle = 'rgba(241,235,225,.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x - dx, ball.y - dy); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 1; i <= 16; i++) {
      const t = i * .045, x = ball.x + vx * t, y = ball.y + vy * t + .5 * G * t * t;
      if (y > floorY) break;
      ctx.fillStyle = `rgba(184,255,74,${(1 - i / 17) * .9})`;
      ctx.beginPath(); ctx.arc(x, y, 3 - i * .1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = `hsl(${120 - power * 110},90%,60%)`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, R + 7, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2); ctx.stroke();
  } else if (ball.state === 'idle' && game.state === 'ready') {
    const s = 1 + (Math.sin(time * 4) + 1) * .25;
    ctx.strokeStyle = 'rgba(184,255,74,.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, (R + 6) * s, 0, Math.PI * 2); ctx.stroke();
  }

  drawBall(ball.x, ball.y, ball.a);

  // filet (dessiné après le ballon pour la profondeur)
  const netH = R * 2.6, sw = Math.sin(time * 22) * hoop.sway * 5;
  const top = [hoop.x - RIM, hoop.x - RIM / 3, hoop.x + RIM / 3, hoop.x + RIM];
  const bot = top.map(x => hoop.x + (x - hoop.x) * .55 + sw);
  ctx.strokeStyle = 'rgba(241,235,225,.75)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { ctx.moveTo(top[i], hoop.y); ctx.lineTo(bot[i], hoop.y + netH); }
  for (let i = 0; i < 3; i++) { ctx.moveTo(top[i], hoop.y); ctx.lineTo(bot[i + 1], hoop.y + netH); ctx.moveTo(top[i + 1], hoop.y); ctx.lineTo(bot[i], hoop.y + netH); }
  ctx.moveTo(bot[0], hoop.y + netH); ctx.lineTo(bot[3], hoop.y + netH);
  ctx.stroke();
  // arceau
  ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hoop.x - RIM, hoop.y); ctx.lineTo(bx, hoop.y); ctx.stroke();
}

/* ---------- boucle ---------- */
let last = 0;
function loop(now) {
  if (!visible) { running = false; return; }
  const dt = Math.min((now - last) / 1000 || 0, .033); last = now; time += dt;
  if (game.state === 'play') {
    game.clock -= dt;
    if (game.clock <= 0) { game.clock = 0; if (ball.state === 'fly') game.state = 'buzzer'; else gameOver(); }
    hud();
  }
  for (let i = 0; i < 4; i++) step(dt / 4);
  draw();
  requestAnimationFrame(loop);
}
new IntersectionObserver(([en]) => {
  visible = en.isIntersecting;
  if (visible && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
}, { threshold: .15 }).observe(wrap);
new ResizeObserver(resize).observe(wrap);
resize(); hud();
})();
