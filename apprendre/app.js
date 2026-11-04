/* Pépite — 10 infos par jour pour sa culture générale */
(() => {
  "use strict";

  const THEMES = window.THEMES;
  const FACTS = window.FACTS;
  const themeById = Object.fromEntries(THEMES.map(t => [t.id, t]));
  const factById = Object.fromEntries(FACTS.map(f => [f.id, f]));
  const PER_DAY = 10;
  const KEY = "pepite-v2";

  // 4 thèmes de couleur de l'appli
  // 2 versions du thème néon (sombre / clair)
  const PALETTES = [
    { id: "nuit", name: "Néon nuit", desc: "Violet & noir, sombre", bg: "#0B0713", line: "#2C2142", p: "#9146FF", d: "#6527C9", bar: "#0B0713" },
    { id: "jour", name: "Néon jour", desc: "Violet & rose, clair",  bg: "#F8F4FF", line: "#E3D8F7", p: "#8A3FFC", d: "#6524D6", bar: "#F8F4FF" }
  ];

  // ---------- Dates ----------
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); return dayKey(new Date(y, m - 1, d + n)); };
  const today = () => dayKey();

  // ---------- État ----------
  const defaults = () => ({
    read: {},          // factId -> date ISO de première lecture
    favs: {},
    themesOff: {},
    daily: null,       // { date, ids, pos, done }
    streak: 0, bestStreak: 0, lastDay: null,
    days: {},          // date -> nb d'infos lues
    palette: "nuit",
    sound: true,
    installDismissed: false
  });
  let S;
  try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "null") || migrate()); } catch { S = defaults(); }
  function migrate() { // reprend la progression de la première version
    try {
      const o = JSON.parse(localStorage.getItem("pepite-v1") || "null"); if (!o) return {};
      const read = {}; Object.entries(o.learned || {}).forEach(([id, v]) => { read[id] = v.at || new Date().toISOString(); });
      return { read, favs: o.favs || {}, themesOff: o.themesOff || {}, streak: o.streak || 0, bestStreak: o.bestStreak || 0,
        lastDay: o.lastDay || null, days: Object.fromEntries(Object.keys(o.days || {}).map(k => [k, 1])), sound: o.sound !== false, installDismissed: !!o.installDismissed };
    } catch { return {}; }
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

  const currentStreak = () => (S.lastDay === today() || S.lastDay === addDays(today(), -1)) ? S.streak : 0;
  const nRead = () => Object.keys(S.read).filter(id => factById[id]).length;

  // ---------- Couleurs ----------
  function applyPalette() {
    if (!PALETTES.some(x => x.id === S.palette)) S.palette = "nuit"; // anciennes couleurs -> néon
    const p = PALETTES.find(x => x.id === S.palette);
    document.documentElement.dataset.palette = p.id;
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = p.bar;
  }

  // ---------- Choix des infos (même sélection toute la journée) ----------
  const seeded = (str) => {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  };
  const shuffle = (arr, rnd = Math.random) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const enabledThemes = () => { const on = THEMES.filter(t => !S.themesOff[t.id]); return on.length ? on : THEMES; };

  // n infos, en variant au maximum les thèmes ; infos jamais lues d'abord
  function pick(n, rnd, themeIds, exclude = []) {
    const out = [];
    const take = (pool) => {
      const byTheme = {};
      shuffle(pool, rnd).forEach(f => (byTheme[f.theme] ||= []).push(f));
      let order = shuffle(Object.keys(byTheme), rnd);
      while (out.length < n && order.length) {
        for (const t of order) { if (out.length >= n) break; const f = byTheme[t].shift(); if (f) out.push(f.id); }
        order = order.filter(t => byTheme[t].length);
      }
    };
    take(FACTS.filter(f => themeIds.includes(f.theme) && !S.read[f.id] && !exclude.includes(f.id)));
    if (out.length < n) { // tout a été lu : on repasse les plus anciennes
      const old = FACTS.filter(f => themeIds.includes(f.theme) && !out.includes(f.id) && !exclude.includes(f.id))
        .sort((a, b) => (S.read[a.id] || "").localeCompare(S.read[b.id] || ""));
      out.push(...old.slice(0, n - out.length).map(f => f.id));
    }
    return out;
  }
  function getDaily() {
    if (!S.daily || S.daily.date !== today()) {
      S.daily = { date: today(), ids: pick(PER_DAY, seeded("pepite" + today()), enabledThemes().map(t => t.id)), pos: 0, done: false };
      save();
    }
    return S.daily;
  }

  // ---------- Utilitaires d'affichage ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tv = (t) => `--tc:${t.color};--td:${t.dark}`;
  const chip = (t) => `<span class="chip" style="${tv(t)}"><span class="e">${t.icon}</span>${esc(t.name)}</span>`;
  const tile = (t) => `<span class="icon-tile" style="${tv(t)}">${t.icon}</span>`;
  const plural = (n, s, p = s + "s") => `${n} ${n > 1 ? p : s}`;
  const SHARE_SVG = `<svg viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V1M4 5l4-4 4 4"/><path d="M5 8H2v11h12V8h-3"/></svg>`;

  // Néko, chat néon de Tokyo (SVG). mood : "happy" | "wow" | "think"
  let mascotN = 0;
  const NEKO_PATH = "M24 54 L20 14 Q21 10 25 12 L48 30 Q60 27 72 30 L95 12 Q99 10 100 14 L96 54 Q102 66 99 80 Q92 106 60 107 Q28 106 21 80 Q18 66 24 54 Z";
  function mascot(mood = "happy", style = "") {
    const id = "nk" + (++mascotN);
    const eyes = mood === "think"
      ? `<path d="M36 66 q8 -8 16 0" stroke="#2DE2FF" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#${id}g)"/><path d="M68 66 q8 -8 16 0" stroke="#2DE2FF" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#${id}g)"/>`
      : `<g filter="url(#${id}g)"><ellipse cx="43" cy="64" rx="${mood === "wow" ? 10.5 : 9.5}" ry="${mood === "wow" ? 12 : 10.5}" fill="#2DE2FF"/><ellipse cx="77" cy="64" rx="${mood === "wow" ? 10.5 : 9.5}" ry="${mood === "wow" ? 12 : 10.5}" fill="#2DE2FF"/></g>
         <ellipse cx="43" cy="65" rx="${mood === "wow" ? 5 : 3.6}" ry="${mood === "wow" ? 7 : 7.5}" fill="#0B0713"/><ellipse cx="77" cy="65" rx="${mood === "wow" ? 5 : 3.6}" ry="${mood === "wow" ? 7 : 7.5}" fill="#0B0713"/>
         <circle cx="46.5" cy="59.5" r="2.8" fill="#fff"/><circle cx="80.5" cy="59.5" r="2.8" fill="#fff"/>`;
    const mouth = mood === "wow"
      ? `<ellipse cx="60" cy="88" rx="5.5" ry="6.5" fill="#FF2E97"/>`
      : `<path d="M51 84 q4.5 5 9 0 q4.5 5 9 0" stroke="#FF2E97" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<svg class="mascot" style="${style}" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="${id}n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B07CFF"/><stop offset=".55" stop-color="#C13BFF"/><stop offset="1" stop-color="#FF2E97"/></linearGradient>
        <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E1A52"/><stop offset="1" stop-color="#160C29"/></linearGradient>
        <filter id="${id}g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <ellipse cx="60" cy="114" rx="30" ry="4" fill="rgba(145,70,255,.25)"/>
      <path d="${NEKO_PATH}" fill="url(#${id}b)"/>
      <path d="${NEKO_PATH}" fill="none" stroke="url(#${id}n)" stroke-width="4.5" stroke-linejoin="round" filter="url(#${id}g)"/>
      <path d="M28 22 L32 44 L45 33 Z" fill="#FF2E97" opacity=".55"/><path d="M92 22 L88 44 L75 33 Z" fill="#FF2E97" opacity=".55"/>
      <ellipse cx="31" cy="80" rx="7" ry="4" fill="#FF2E97" opacity=".35"/><ellipse cx="89" cy="80" rx="7" ry="4" fill="#FF2E97" opacity=".35"/>
      ${eyes}
      <path d="M56.5 77 h7 l-3.5 4 z" fill="#FF2E97"/>
      ${mouth}
      <g stroke="#2DE2FF" stroke-width="2" stroke-linecap="round" opacity=".75"><path d="M18 76 l14 2"/><path d="M19 86 l13 -3"/><path d="M102 76 l-14 2"/><path d="M101 86 l-13 -3"/></g>
      <path d="M38 22 q3 -1 4 2" stroke="#fff" stroke-width="0" fill="none"/>
    </svg>`;
  }

  function ring(p) {
    const r = 24, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, p));
    return `<svg class="ring" viewBox="0 0 58 58"><circle cx="29" cy="29" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"/>
      <circle cx="29" cy="29" r="${r}" fill="none" stroke="var(--streak)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 29 29)"/>
      <text x="29" y="34" text-anchor="middle" font-size="16">${p >= 1 ? "🔥" : "⚡"}</text></svg>`;
  }

  let toastT;
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2200); }
  function confetti() {
    const colors = ["#58CC02", "#1CB0F6", "#FFC800", "#FF4B4B", "#CE82FF", "#FF9600"];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement("i"); c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw"; c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.6 + Math.random() * 1.6 + "s"; c.style.animationDelay = Math.random() * .4 + "s";
      document.body.appendChild(c); setTimeout(() => c.remove(), 4000);
    }
  }

  // ---------- Sons (synthétisés) ----------
  let ac;
  function tone(notes) {
    if (!S.sound) return;
    try {
      ac ||= new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      let t = ac.currentTime;
      for (const [f, d, type = "sine", v = .15] of notes) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + d);
        o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02); t += d * .6;
      }
    } catch {}
  }
  const sfx = {
    tap: () => tone([[660, .06, "sine", .05]]),
    page: () => tone([[880, .07, "sine", .06], [1175, .1, "sine", .05]]),
    star: () => tone([[784, .1], [1047, .18]]),
    win: () => tone([[523, .14], [659, .14], [784, .14], [1047, .4]])
  };

  // ---------- Barre du haut ----------
  function renderTop() {
    $("#brand").innerHTML = mascot("happy", "width:28px;height:28px") + "Pépite";
    $("#streak-n").textContent = currentStreak();
    $("#stat-streak").classList.toggle("dim", S.lastDay !== today());
    $("#read-n").textContent = nRead();
  }

  // ---------- Vues ----------
  let tab = "home", sub = null, libFilter = "all";
  function render() {
    renderTop();
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $("#view").innerHTML = tab === "home" ? viewHome() : tab === "themes" ? (sub ? viewTheme(sub) : viewThemes()) : tab === "library" ? viewLibrary() : viewSettings();
  }

  function weekStrip() {
    const labels = ["L", "M", "M", "J", "V", "S", "D"], dow = (new Date().getDay() + 6) % 7;
    return `<div class="week">${labels.map((l, i) => { const k = addDays(today(), i - dow), on = !!S.days[k];
      return `<div class="d ${on ? "on" : ""} ${k === today() ? "today" : ""}"><i>${on ? "🔥" : ""}</i>${l}</div>`; }).join("")}</div>`;
  }

  function viewHome() {
    const d = getDaily();
    const facts = d.ids.map(id => factById[id]).filter(Boolean);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
    const h = new Date().getHours(), hello = h < 12 ? "Bonjour" : h < 18 ? "Salut" : "Bonsoir";
    const st = currentStreak();
    const msg = d.done ? `Bravo ! 10 infos de plus dans ta culture G. Reviens demain pour la suite 🔥`
      : d.pos > 0 ? `Tu en es à ${d.pos}/10. On termine ?`
      : st > 0 ? `${hello} ! ${plural(st, "jour")} de suite, continue comme ça.` : `${hello} ! Tes 10 infos du jour t'attendent.`;
    const dots = facts.map((f, i) => { const t = themeById[f.theme];
      return `<span class="theme-dot ${d.done || i < d.pos ? "done" : "todo"}" style="${tv(t)}" title="${esc(t.name)}">${t.icon}</span>`; }).join("");
    const fav = Object.keys(S.favs).filter(id => factById[id]);
    const rnd = fav.length ? factById[fav[Math.floor(Math.random() * fav.length)]] : null;

    return `
      ${isIOS && !standalone && !S.installDismissed ? `
      <div class="card install-card"><button class="x" data-act="dismiss-install">×</button>
        <b>📲 Installe Pépite sur ton iPhone</b>
        <p class="tip">Dans Safari, touche <b>Partager</b> <svg class="share-ico" viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V1M4 5l4-4 4 4"/><path d="M5 8H2v11h12V8h-3"/></svg> puis <b>« Sur l'écran d'accueil »</b>.</p>
      </div><div style="height:16px"></div>` : ""}
      <div class="hero">${mascot(d.done ? "wow" : "happy")}<div class="bubble">${msg}</div></div>
      <div class="card daily">
        <div class="date">${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h2>${d.done ? "Infos du jour lues !" : "Tes 10 infos du jour"}</h2>
        <div class="theme-dots">${dots}</div>
        <div class="count-line"><b>${d.done ? 10 : d.pos}/10</b> lues · ${plural(new Set(facts.map(f => f.theme)).size, "thème")} différents</div>
        ${d.done
          ? `<div class="btn-row" style="margin-top:0"><button class="btn gold" data-act="daily-replay">Relire les infos du jour</button>
             <button class="btn ghost" data-act="bonus">+ 5 infos bonus</button></div>`
          : `<button class="btn" data-act="daily">${d.pos > 0 ? "Continuer" : "Commencer"}</button>`}
      </div>
      <h3 class="section-title">Ta série</h3>
      <div class="card">
        <div class="goal">${ring(d.done ? 1 : d.pos / PER_DAY)}<div class="txt"><b>${plural(st, "jour")} de suite</b><span>${d.done ? "Objectif du jour atteint ✔" : "Lis tes 10 infos pour l'allumer"}</span></div></div>
        <div style="height:14px"></div>${weekStrip()}
      </div>
      ${rnd ? `<h3 class="section-title">Une de tes favorites</h3>
        <button class="fact-item" data-fact="${rnd.id}">${tile(themeById[rnd.theme])}<div class="t">${chip(themeById[rnd.theme])}<b>${esc(rnd.title)}</b></div><span class="fav">⭐</span></button>` : ""}`;
  }

  function viewThemes() {
    const cards = THEMES.map(t => {
      const all = FACTS.filter(f => f.theme === t.id), got = all.filter(f => S.read[f.id]).length, off = !!S.themesOff[t.id];
      return `<button class="theme-card ${off ? "off" : ""}" style="${tv(t)}" data-theme="${t.id}">
        <span class="big">${t.icon}</span><span class="name">${esc(t.name)}</span>
        <div class="bar"><i style="width:${(got / all.length) * 100}%"></i></div>
        <span class="meta">${got}/${all.length} infos</span>${off ? `<span class="pin" title="Exclu des infos du jour">🚫</span>` : ""}</button>`;
    }).join("");
    return `<h1>Thèmes</h1><p class="sub">${THEMES.length} thèmes pour une culture G complète. Les infos du jour piochent dans les thèmes activés.</p>
      <div style="height:18px"></div><div class="theme-grid">${cards}</div>`;
  }

  function viewTheme(id) {
    const t = themeById[id], all = FACTS.filter(f => f.theme === id), got = all.filter(f => S.read[f.id]), on = !S.themesOff[id];
    const list = all.map(f => S.read[f.id]
      ? `<button class="fact-item" data-fact="${f.id}">${tile(t)}<div class="t"><b>${esc(f.title)}</b><span class="desc">${esc(f.text.slice(0, 85))}…</span></div>${S.favs[f.id] ? `<span class="fav">⭐</span>` : ""}</button>`
      : `<div class="fact-item locked">${tile(t)}<div class="t"><b>🔒 À découvrir</b><span class="desc">Elle arrivera bientôt dans tes infos du jour</span></div></div>`).join("");
    const left = all.length - got.length;
    return `<button class="back" data-act="back">‹ Thèmes</button>
      <div class="theme-head" style="${tv(t)}"><span class="e">${t.icon}</span><div><h1>${esc(t.name)}</h1><p>${got.length} sur ${all.length} infos lues</p></div></div>
      <div class="card"><div class="toggle-line"><div><b>Dans mes infos du jour</b><p class="sub" style="margin:2px 0 0;font-size:13px">Désactive pour ne plus recevoir ce thème</p></div>
        <button class="switch ${on ? "on" : ""}" data-act="toggle-theme" data-id="${id}" aria-label="Activer le thème"></button></div></div>
      ${left ? `<div class="btn-row"><button class="btn" style="--btn-bg:${t.color};--d:${t.dark}" data-act="theme-read" data-id="${id}">Lire ${Math.min(5, left)} infos de ce thème</button></div>` : ""}
      <h3 class="section-title">Les infos</h3>${list}`;
  }

  function viewLibrary() {
    const ids = Object.keys(S.read).filter(id => factById[id]).sort((a, b) => S.read[b].localeCompare(S.read[a]));
    if (!ids.length) return `<h1>Mes infos</h1><div class="empty">${mascot()}<p>Toutes les infos que tu lis arrivent ici,<br>classées par thème.</p>
      <div class="btn-row"><button class="btn" data-act="go-home">Lire mes infos du jour</button></div></div>`;
    const present = THEMES.filter(t => ids.some(id => factById[id].theme === t.id));
    const filters = [`<button class="filter ${libFilter === "all" ? "on" : ""}" data-filter="all">Tout · ${ids.length}</button>`,
      `<button class="filter ${libFilter === "fav" ? "on" : ""}" style="--tc:#E5A800;--td:#B88700" data-filter="fav">⭐ Favoris</button>`,
      ...present.map(t => `<button class="filter ${libFilter === t.id ? "on" : ""}" style="${tv(t)}" data-filter="${t.id}">${t.icon} ${esc(t.name)}</button>`)].join("");
    const shown = ids.filter(id => libFilter === "all" || (libFilter === "fav" ? S.favs[id] : factById[id].theme === libFilter));
    const list = shown.map(id => { const f = factById[id], t = themeById[f.theme];
      return `<button class="fact-item" data-fact="${id}">${tile(t)}<div class="t">${chip(t)}<b>${esc(f.title)}</b></div>${S.favs[id] ? `<span class="fav">⭐</span>` : ""}</button>`; }).join("");
    return `<h1>Mes infos</h1><p class="sub">${plural(ids.length, "info lue", "infos lues")} · touche une info pour la relire.</p>
      <div style="height:14px"></div><div class="filters">${filters}</div>
      ${list || `<div class="empty"><p>${libFilter === "fav" ? "Touche ⭐ pendant ta lecture pour garder une info ici." : "Aucune info ici pour l'instant."}</p></div>`}`;
  }

  const LEVELS = [[0, "Curieux", "🌱"], [30, "Apprenti", "📘"], [80, "Érudit", "🎓"], [150, "Savant", "🔭"], [220, "Sage", "🦉"], [300, "Encyclopédie", "👑"]];
  function viewSettings() {
    const n = nRead();
    let li = 0; LEVELS.forEach((l, i) => { if (n >= l[0]) li = i; });
    const cur = LEVELS[li], next = LEVELS[li + 1], p = next ? (n - cur[0]) / (next[0] - cur[0]) : 1;
    const top = THEMES.map(t => [t, FACTS.filter(f => f.theme === t.id && S.read[f.id]).length]).sort((a, b) => b[1] - a[1])[0];
    const pal = PALETTES.map(x => `<button class="palette ${S.palette === x.id ? "on" : ""}" data-pal="${x.id}" style="--pv-bg:${x.bg};--pv-line:${x.line};--pv-p:linear-gradient(120deg, ${x.p}, #FF2E97);--pv-d:${x.d}">
        <span class="preview"><span class="pv-dot"></span><span class="pv-line"></span><span class="pv-btn"></span></span>
        <span class="name">${x.name}<small>${x.desc}</small></span></button>`).join("");
    return `<h1>Réglages</h1><div style="height:16px"></div>
      <div class="card level"><span class="badge">${cur[2]}</span><div class="txt"><b>${cur[1]}</b>
        <p class="sub" style="margin:2px 0 8px;font-size:13px">${next ? `Encore ${plural(next[0] - n, "info")} avant « ${next[1]} »` : "Niveau maximum atteint !"}</p>
        <div class="bar" style="--tc:var(--gold)"><i style="width:${p * 100}%"></i></div></div></div>
      <h3 class="section-title">Thème néon</h3>
      <div class="palettes">${pal}</div>
      <h3 class="section-title">Statistiques</h3>
      <div class="stats-grid">
        <div class="stat-box"><span class="e">🔥</span><div><b>${currentStreak()}</b><span>Série actuelle</span></div></div>
        <div class="stat-box"><span class="e">🏅</span><div><b>${S.bestStreak}</b><span>Record</span></div></div>
        <div class="stat-box"><span class="e">📚</span><div><b>${n}/${FACTS.length}</b><span>Infos lues</span></div></div>
        <div class="stat-box"><span class="e">⭐</span><div><b>${Object.keys(S.favs).length}</b><span>Favoris</span></div></div>
      </div>
      ${top && top[1] ? `<div class="card" style="margin-top:14px"><div class="peek">${tile(top[0])}<div class="t"><span>Thème le plus lu</span><b>${esc(top[0].name)}</b></div></div></div>` : ""}
      <h3 class="section-title">Néko, l'IA</h3>
      <div class="card">${getKey()
        ? `<div class="peek">${mascot("happy", "width:46px;height:46px;flex:none")}<div class="t"><b>Néko est activé</b><span>Clé ${esc(getKey().slice(0, 10))}…${esc(getKey().slice(-4))} · ${Object.keys(chats()).length} conversation(s)</span></div></div>
           <div class="btn-row"><button class="btn ghost" data-act="clear-chats">Effacer les conversations</button><button class="btn ghost" style="color:#FF4B4B" data-act="remove-key">Supprimer la clé</button></div>`
        : `<div class="peek">${mascot("think", "width:46px;height:46px;flex:none")}<div class="t"><b>Néko dort</b><span>Ajoute ta clé API Anthropic pour poser des questions sur chaque info.</span></div></div>
           <div style="height:12px"></div><input class="key-input" id="key-set" type="password" placeholder="sk-ant-…" autocomplete="off" autocapitalize="off" spellcheck="false">
           <div class="btn-row"><button class="btn" data-act="save-key-settings">Activer Néko</button></div>
           <p class="small-note">Crée ta clé sur <a href="https://console.anthropic.com" target="_blank" rel="noopener" style="color:var(--p-text)">console.anthropic.com</a> (API Keys). Environ 1 centime par question. La clé reste sur ton iPhone.</p>`}</div>
      <h3 class="section-title">Préférences</h3>
      <div class="card"><div class="toggle-line"><b>🔊 Sons</b><button class="switch ${S.sound ? "on" : ""}" data-act="sound" aria-label="Sons"></button></div></div>
      <div class="card"><p class="tip" style="margin:0">💡 <b>Astuce :</b> une info pas claire ? Touche « Demander à Néko » sous l'info et pose ta question.</p></div>
      <button class="link-danger" data-act="reset">Réinitialiser ma progression</button>`;
  }

  // ---------- Lecture ----------
  let R = null; // { ids, i, mode: "daily" | "extra" | "replay", dir }

  function openReader(ids, mode, start = 0) {
    if (!ids.length) { toast("Tu as déjà tout lu dans ce thème !"); return; }
    R = { ids, i: Math.min(start, ids.length - 1), mode, dir: 1 };
    $("#reader").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    renderCard();
  }
  function closeReader() { $("#reader").classList.add("hidden"); document.body.style.overflow = ""; R = null; render(); }

  function renderCard(quiet) {
    const id = R.ids[R.i], f = factById[id], t = themeById[f.theme];
    if (R.mode !== "replay" && !S.read[id]) S.read[id] = new Date().toISOString();
    if (R.mode === "daily") S.daily.pos = Math.max(S.daily.pos, R.i + 1);
    save();
    const last = R.i === R.ids.length - 1;
    const segs = R.ids.map((_, k) => `<i class="${k < R.i ? "done" : k === R.i ? "cur" : ""}"></i>`).join("");
    $("#reader").innerHTML = `<div class="reader-inner">
        <div class="reader-top"><button class="close" data-act="close" aria-label="Fermer">✕</button>
          <div class="segments">${segs}</div><span class="counter">${R.i + 1}/${R.ids.length}</span></div>
        <div class="reader-body" id="rbody"><div class="${quiet ? "" : R.dir > 0 ? "step-enter" : "step-back"}">
          <div class="fact-card"><div class="band" style="${tv(t)}" data-icon="${t.icon}"><span class="e">${t.icon}</span>
            <div><div class="lbl">Thème</div><div class="nm">${esc(t.name)}</div></div></div>
            <div class="content"><h2>${esc(f.title)}</h2><p>${esc(f.text)}</p></div></div>
          <button class="ask-btn" data-act="ask" data-id="${id}">${mascot("happy")}<div class="t"><b>Demander à Néko</b><span>Pas compris ? Envie d'en savoir plus ?</span></div>${nQuestions(id) ? `<span class="n">${nQuestions(id)} ❓</span>` : ""}</button>
          ${R.i === 0 && R.ids.length > 1 ? `<div class="swipe-hint">Glisse vers la gauche pour passer à la suivante</div>` : ""}
        </div></div></div>
      <div class="reader-foot"><div class="inner">
        <button class="icon-btn ${S.favs[id] ? "on" : ""}" data-act="fav" data-id="${id}" aria-label="Favori">${S.favs[id] ? "⭐" : "☆"}</button>
        <button class="icon-btn" data-act="share" data-id="${id}" aria-label="Partager">${SHARE_SVG}</button>
        <button class="btn" data-act="next">${last ? "Terminer" : "Suivante"}</button>
      </div></div>`;
  }

  function go(delta) {
    if (!R || R.finished) return;
    const n = R.i + delta;
    if (n < 0) return;
    if (n >= R.ids.length) return finish();
    R.i = n; R.dir = delta; sfx.page(); renderCard();
  }

  function finish() {
    const counted = R.mode !== "replay";
    if (R.mode === "daily") { S.daily.done = true; S.daily.pos = PER_DAY; }
    if (R.mode === "daily" && S.lastDay !== today()) {
      S.streak = S.lastDay === addDays(today(), -1) ? S.streak + 1 : 1;
      S.lastDay = today(); S.bestStreak = Math.max(S.bestStreak, S.streak);
    }
    if (counted) S.days[today()] = (S.days[today()] || 0) + R.ids.length;
    save(); sfx.win(); if (counted) confetti();
    const facts = R.ids.map(id => factById[id]);
    const nThemes = new Set(facts.map(f => f.theme)).size;
    $("#reader").innerHTML = `<div class="reader-inner"><div class="reader-body finish">
        ${mascot("wow")}
        <h1>${R.mode === "daily" ? "Culture G boostée !" : R.mode === "extra" ? "Bien joué !" : "Bien relu !"}</h1>
        <p class="sub">${R.mode === "daily" ? "Tes 10 infos du jour sont lues." : plural(facts.length, "info") + (R.mode === "replay" ? " relue" + (facts.length > 1 ? "s." : ".") : " de plus.")}</p>
        ${counted ? `<div class="result-row">
          <div class="result" style="--rc:#FF9600"><div class="h">Série</div><div class="v">🔥 ${currentStreak()}</div></div>
          <div class="result" style="--rc:#1CB0F6"><div class="h">Thèmes</div><div class="v">🧭 ${nThemes}</div></div>
          <div class="result" style="--rc:#58CC02"><div class="h">Total lu</div><div class="v">📚 ${nRead()}</div></div></div>` : ""}
        <div class="card learned-list"><b>${R.mode === "replay" ? "Au programme" : "Aujourd'hui tu as appris"}</b>
          ${facts.map(f => { const t = themeById[f.theme]; return `<div class="row">${tile(t)}<span>${esc(f.title)}</span></div>`; }).join("")}</div>
      </div></div>
      <div class="reader-foot"><div class="inner"><button class="btn" data-act="close">Continuer</button></div></div>`;
    R.finished = true;
  }

  async function share(id) {
    const f = factById[id], t = themeById[f.theme];
    const text = `${t.icon} ${f.title}\n\n${f.text}\n\n— Pépite, 10 infos par jour`;
    try {
      if (navigator.share) { await navigator.share({ title: f.title, text, url: location.href.split("#")[0] }); return; }
      await navigator.clipboard.writeText(text); toast("Info copiée, colle-la où tu veux !");
    } catch (e) { if (e && e.name !== "AbortError") toast("Partage impossible sur cet appareil"); }
  }

  // ---------- Néko, l'IA (Claude, via la clé API de l'utilisateur) ----------
  const AI_KEY = "pepite-ai-key", CHAT_KEY = "pepite-chat-v1";
  const MODEL = "claude-opus-5-5";
  const SDK_URL = "./vendor/anthropic-sdk-0.137.0.mjs"; // SDK officiel @anthropic-ai/sdk, empaqueté pour le navigateur
  const SYSTEM = `Tu es Néko, le chat néon qui sert de guide dans Pépite, une appli de culture générale. L'utilisateur vient de lire une courte info et te pose des questions à son sujet.

Réponds en français, en tutoyant, avec un ton chaleureux et clair. Fais court : en général 3 à 8 phrases, sauf si on te demande explicitement plus de détails. Va droit à la réponse, sans reformuler la question.
- Si on te demande d'expliquer plus simplement : des mots simples, une comparaison concrète de la vie quotidienne.
- Si on veut en savoir plus : ajoute du contexte, des dates, des chiffres, des personnages et une anecdote marquante.
- Sois rigoureux : si un point est incertain, débattu ou une légende, dis-le. N'invente jamais de chiffre, de citation ou de source.
- Tes connaissances s'arrêtent à une certaine date : pour l'actualité récente, précise que la situation a pu évoluer depuis.
- Les questions qui s'éloignent de l'info sont bienvenues tant qu'elles restent de la culture générale.
Mise en forme : pas de titres ni de tableaux. Tu peux utiliser du **gras** pour les mots clés et de courtes listes à puces.`;
  const SUGGESTIONS = ["Explique-moi plus simplement", "Je veux en savoir plus", "Pourquoi c'est important ?", "Une anecdote en plus ?", "Et aujourd'hui, ça en est où ?"];
  const SEND_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;

  let sdkP = null, C = null; // C = conversation ouverte { id, msgs, busy, partial, stream, error }
  const getKey = () => { try { return localStorage.getItem(AI_KEY) || ""; } catch { return ""; } };
  const setKey = (k) => { try { k ? localStorage.setItem(AI_KEY, k) : localStorage.removeItem(AI_KEY); } catch {} };
  const chats = () => { try { return JSON.parse(localStorage.getItem(CHAT_KEY) || "{}"); } catch { return {}; } };
  function saveChat(id, msgs) {
    const all = chats(); all[id] = { msgs, at: Date.now() };
    Object.keys(all).sort((a, b) => all[b].at - all[a].at).slice(40).forEach(k => delete all[k]); // garde les 40 dernières
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(all)); } catch {}
  }
  const nQuestions = (id) => ((chats()[id] || {}).msgs || []).filter(m => m.role === "user").length;
  const loadSDK = () => (sdkP ||= import(SDK_URL).then(m => m.default).catch(e => { sdkP = null; throw e; }));
  const msgText = (m) => typeof m.content === "string" ? m.content : m.content.filter(b => b.type === "text").map(b => b.text).join("");

  // Petit rendu markdown sûr (gras, italique, listes)
  const inlineMd = (t) => t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, "$1<i>$2</i>");
  function md(txt) {
    let html = "", list = false;
    for (const line of esc(txt).split("\n")) {
      const li = line.match(/^\s*[-•*]\s+(.*)/);
      if (li) { if (!list) { html += "<ul>"; list = true; } html += `<li>${inlineMd(li[1])}</li>`; continue; }
      if (list) { html += "</ul>"; list = false; }
      if (line.trim()) html += `<p>${inlineMd(line.replace(/^#+\s*/, ""))}</p>`;
    }
    return html + (list ? "</ul>" : "");
  }

  // Après un relais de modèle (fallback) en cours de réponse, on ne renvoie pas les blocs internes situés avant le relais
  function cleanContent(content) {
    const last = content.map(b => b.type).lastIndexOf("fallback");
    if (last < 0) return content;
    return content.filter((b, i) => i > last || !["thinking", "redacted_thinking", "tool_use"].includes(b.type));
  }

  function errMsg(e, A) {
    if (A && e instanceof A.AuthenticationError) return "Ta clé API n'est pas valide. Vérifie-la (ou remplace-la) dans ⚙️ Réglages.";
    if (A && e instanceof A.PermissionDeniedError) return "Cette clé API n'a pas accès à ce modèle. Vérifie ton compte sur console.anthropic.com.";
    if (A && e instanceof A.RateLimitError) return "Beaucoup de questions d'un coup ! Attends quelques secondes et réessaie.";
    if (A && e instanceof A.BadRequestError) return /credit|balance|billing/i.test(e.message || "")
      ? "Ton crédit Anthropic est épuisé. Recharge-le sur console.anthropic.com (rubrique Billing)."
      : "La question n'a pas pu être envoyée : " + (e.message || "requête invalide") + ".";
    if (A && e instanceof A.APIConnectionError) return "Pas de connexion internet. Néko a besoin du réseau pour répondre.";
    if (A && e instanceof A.APIError && (e.status >= 500 || e.status === 529)) return "Les serveurs de Claude sont surchargés. Réessaie dans un instant.";
    if (!A) return "Impossible de charger le module de l'IA. Vérifie ta connexion et réessaie.";
    return "Oups, une erreur est survenue : " + (e.message || e) + ".";
  }

  function openChat(id) {
    C = { id, msgs: (chats()[id] || {}).msgs || [], busy: false, partial: "", error: "" };
    let el = $("#chat");
    if (!el) { el = document.createElement("div"); el.id = "chat"; document.body.appendChild(el); }
    el.className = "chat";
    renderChat();
    loadSDK().catch(() => {}); // préchargement
  }
  function closeChat() {
    if (C && C.stream) { try { C.stream.abort(); } catch {} }
    C = null; const el = $("#chat"); if (el) el.remove();
    if (R && !R.finished) renderCard(true);
  }

  function chatHead() {
    const f = factById[C.id], t = themeById[f.theme];
    return `<div class="sheet-head">${mascot(C.busy ? "think" : "happy")}
      <div class="t"><b>Néko</b><span>${t.icon} ${esc(f.title)}</span></div>
      <button class="close" data-act="chat-close" aria-label="Fermer">✕</button></div>`;
  }

  function renderChat() {
    const el = $("#chat"); if (!el || !C) return;
    if (!getKey()) {
      el.innerHTML = `<div class="sheet">${chatHead()}<div class="key-setup">
        <div class="msg intro" style="margin-bottom:14px">Salut, moi c'est <b>Néko</b> 🐾 Je réponds à toutes tes questions sur les infos. Pour me réveiller, Pépite a besoin d'une clé pour Claude, l'IA d'Anthropic. C'est à faire une seule fois.</div>
        <b>Comment obtenir ta clé</b>
        <ol>
          <li>Crée un compte sur <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a>.</li>
          <li>Dans <b>Billing</b>, ajoute un peu de crédit (5 $ suffisent pour des centaines de questions, environ 1 centime chacune).</li>
          <li>Dans <b>API Keys</b>, touche <b>Create Key</b> et copie la clé (elle commence par <b>sk-ant-</b>).</li>
          <li>Colle-la juste en dessous.</li>
        </ol>
        <input class="key-input" id="key-in" type="password" placeholder="sk-ant-…" autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="btn-row"><button class="btn" data-act="save-key">Activer Néko</button></div>
        <p class="small-note">🔒 La clé reste uniquement sur ton iPhone et n'est envoyée qu'à Anthropic. Ne la partage jamais et ne la publie nulle part. Tu peux la supprimer à tout moment dans les Réglages.</p>
      </div></div>`;
      return;
    }
    const bubbles = C.msgs.map(m => m.role === "user"
      ? `<div class="msg user">${esc(m.show || m.content)}</div>`
      : `<div class="msg ai">${md(msgText(m))}</div>`).join("");
    const pending = C.busy ? `<div class="msg ai" id="partial">${C.partial ? md(C.partial) : `<span class="typing"><i></i><i></i><i></i></span>`}</div>` : "";
    const intro = !C.msgs.length && !C.busy ? `<div class="msg intro">Pose-moi n'importe quelle question sur cette info : un mot pas compris, un détail, la suite de l'histoire… 🐾</div>` : "";
    const err = C.error ? `<div class="msg err">${esc(C.error)}</div>` : "";
    el.innerHTML = `<div class="sheet">${chatHead()}
      <div class="msgs" id="msgs">${intro}${bubbles}${pending}${err}</div>
      ${C.busy ? "" : `<div class="suggest">${SUGGESTIONS.map(q => `<button data-act="suggest" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>`}
      <div class="composer"><textarea id="chat-in" rows="1" enterkeyhint="send" placeholder="Pose ta question à Néko…">${esc(C.draft || "")}</textarea>
        <button class="send" data-act="chat-send" aria-label="Envoyer" ${C.busy ? "disabled" : ""}>${SEND_SVG}</button></div></div>`;
    const box = $("#msgs"); box.scrollTop = box.scrollHeight;
  }
  function updatePartial() {
    const p = $("#partial"); if (!p) return;
    p.innerHTML = md(C.partial);
    const box = $("#msgs"); box.scrollTop = box.scrollHeight;
  }

  async function ask(text) {
    text = (text || "").trim();
    if (!text || !C || C.busy) return;
    const conv = C, f = factById[conv.id], t = themeById[f.theme];
    const content = conv.msgs.length ? text
      : `Voici l'info que je lis dans Pépite (nous sommes le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}) :\n\nThème : ${t.name}\nTitre : ${f.title}\n« ${f.text} »\n\nMa question : ${text}`;
    conv.msgs.push({ role: "user", content, show: text });
    Object.assign(conv, { busy: true, partial: "", error: "", draft: "" });
    renderChat();
    let A = null;
    try {
      A = await loadSDK();
      const client = new A({ apiKey: getKey(), dangerouslyAllowBrowser: true });
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "low" },               // réponses de chat : effort bas = rapide et économique
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",                           // si la question est refusée par erreur, un autre modèle prend le relais
        system: SYSTEM,
        messages: conv.msgs.map(m => ({ role: m.role, content: m.content }))
      });
      conv.stream = stream;
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          conv.partial += ev.delta.text;
          if (C === conv) updatePartial();
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") {
        conv.msgs.pop();
        conv.error = "Néko ne peut pas répondre à cette question. Essaie de la formuler autrement.";
      } else {
        conv.msgs.push({ role: "assistant", content: cleanContent(final.content) });
        saveChat(conv.id, conv.msgs);
      }
    } catch (e) {
      conv.msgs.pop();
      if (!(A && e instanceof A.APIUserAbortError)) { conv.error = errMsg(e, A); conv.draft = text; }
    }
    conv.busy = false; conv.stream = null;
    if (C === conv) renderChat();
  }

  // ---------- Événements ----------
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const act = b.dataset.act;
    if (b.dataset.tab) { sfx.tap(); tab = b.dataset.tab; sub = null; render(); window.scrollTo(0, 0); return; }
    if (b.dataset.theme) { sfx.tap(); sub = b.dataset.theme; render(); window.scrollTo(0, 0); return; }
    if (b.dataset.fact) { sfx.tap(); openReader([b.dataset.fact], "replay"); return; }
    if (b.dataset.filter) { sfx.tap(); libFilter = b.dataset.filter; render(); return; }
    if (b.dataset.pal) { S.palette = b.dataset.pal; save(); applyPalette(); render(); sfx.star(); return; }

    switch (act) {
      case "daily": { const d = getDaily(); openReader(d.ids, "daily", Math.min(d.pos, PER_DAY - 1)); break; }
      case "daily-replay": openReader(getDaily().ids, "replay"); break;
      case "bonus": openReader(pick(5, Math.random, enabledThemes().map(t => t.id), getDaily().ids), "extra"); break;
      case "theme-read": openReader(pick(5, Math.random, [b.dataset.id]).filter(id => !S.read[id]), "extra"); break;
      case "toggle-theme": {
        const id = b.dataset.id;
        if (!S.themesOff[id] && enabledThemes().length <= 1) { toast("Garde au moins un thème activé"); break; }
        S.themesOff[id] ? delete S.themesOff[id] : (S.themesOff[id] = true);
        if (S.daily && S.daily.date === today() && S.daily.pos === 0) S.daily = null; // nouvelle sélection si rien n'est lu
        save(); render(); break;
      }
      case "back": sub = null; render(); break;
      case "go-home": tab = "home"; render(); break;
      case "dismiss-install": S.installDismissed = true; save(); render(); break;
      case "sound": S.sound = !S.sound; save(); render(); sfx.tap(); break;
      case "reset":
        if (confirm("Effacer toute ta progression (série, infos lues, favoris) ?")) { const p = S.palette; S = defaults(); S.palette = p; save(); render(); toast("Progression réinitialisée"); }
        break;
      case "fav": {
        const id = b.dataset.id; S.favs[id] ? delete S.favs[id] : (S.favs[id] = true); save();
        b.classList.toggle("on", !!S.favs[id]); b.textContent = S.favs[id] ? "⭐" : "☆";
        if (S.favs[id]) { sfx.star(); toast("Ajoutée à tes favoris"); } break;
      }
      case "share": share(b.dataset.id); break;
      case "next": go(1); break;
      case "close": closeReader(); break;
      case "ask": sfx.tap(); openChat(b.dataset.id); break;
      case "chat-close": closeChat(); break;
      case "chat-send": { const i = $("#chat-in"); if (i) ask(i.value); break; }
      case "suggest": ask(b.dataset.q); break;
      case "save-key": case "save-key-settings": {
        const i = $(act === "save-key" ? "#key-in" : "#key-set"); const k = (i && i.value || "").trim();
        if (!/^sk-ant-[\w-]{20,}$/.test(k)) { toast("Cette clé ne ressemble pas à une clé Anthropic (sk-ant-…)"); break; }
        setKey(k); sfx.star(); toast("Néko est activé 🐾");
        if (act === "save-key") renderChat(); else render();
        break;
      }
      case "remove-key": if (confirm("Supprimer la clé API de cet appareil ?")) { setKey(""); render(); toast("Clé supprimée"); } break;
      case "clear-chats": if (confirm("Effacer toutes tes conversations avec Néko ?")) { try { localStorage.removeItem(CHAT_KEY); } catch {} render(); toast("Conversations effacées"); } break;
    }
  });

  // Glisser à gauche / à droite pour changer d'info
  let tx = 0, ty = 0;
  document.addEventListener("touchstart", (e) => { if (!R) return; tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!R || R.finished || !e.target.closest("#rbody")) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }, { passive: true });
  document.addEventListener("keydown", (e) => {
    if (C) {
      if (e.target.id === "chat-in" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(e.target.value); }
      if (e.target.id === "key-in" && e.key === "Enter") { e.preventDefault(); $('[data-act="save-key"]').click(); }
      if (e.key === "Escape") closeChat();
      return;
    }
    if (!R || R.finished) return;
    if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "Escape") closeReader();
  });
  document.addEventListener("input", (e) => {
    if (C && e.target.id === "chat-in") {
      C.draft = e.target.value;
      e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !R) render(); });

  applyPalette();
  render();
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
