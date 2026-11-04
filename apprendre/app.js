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
  const PALETTES = [
    { id: "pepite",    name: "Pépite",    desc: "Vert, clair",    bg: "#FFFFFF", line: "#E5E5E5", p: "#58CC02", d: "#58A700", bar: "#FFFFFF" },
    { id: "ocean",     name: "Océan",     desc: "Bleu, clair",    bg: "#FFFFFF", line: "#E1EAF0", p: "#1CB0F6", d: "#1899D6", bar: "#FFFFFF" },
    { id: "framboise", name: "Framboise", desc: "Rose, clair",    bg: "#FFFFFF", line: "#F1E3E8", p: "#FF4F8B", d: "#D93A73", bar: "#FFFFFF" },
    { id: "nuit",      name: "Nuit",      desc: "Violet, sombre", bg: "#131F24", line: "#37464F", p: "#9B7BFF", d: "#7656E0", bar: "#131F24" }
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
    palette: "pepite",
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
    const p = PALETTES.find(x => x.id === S.palette) || PALETTES[0];
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

  function mascot(mood = "happy", style = "") {
    const eyes = `<ellipse cx="44" cy="52" rx="7" ry="8.5" fill="#4B3A00"/><ellipse cx="76" cy="52" rx="7" ry="8.5" fill="#4B3A00"/><circle cx="46.5" cy="49" r="2.6" fill="#fff"/><circle cx="78.5" cy="49" r="2.6" fill="#fff"/>`;
    const mouth = mood === "wow"
      ? `<ellipse cx="60" cy="74" rx="8" ry="9" fill="#4B3A00"/><ellipse cx="60" cy="78" rx="5" ry="4" fill="#FF7A7A"/>`
      : `<path d="M47 68 q13 14 26 0" stroke="#4B3A00" stroke-width="4.5" fill="#fff" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<svg class="mascot" style="${style}" viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(0,0,0,.08)"/>
      <path d="M60 8 L102 34 L96 88 L60 108 L24 88 L18 34 Z" fill="#FFC800" stroke="#E5A800" stroke-width="5" stroke-linejoin="round"/>
      <path d="M60 8 L102 34 L60 40 L18 34 Z" fill="#FFE066"/>
      <path d="M30 30 L44 24" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="34" cy="68" rx="7" ry="4.5" fill="#FF9EAA" opacity=".7"/><ellipse cx="86" cy="68" rx="7" ry="4.5" fill="#FF9EAA" opacity=".7"/>
      ${eyes}${mouth}</svg>`;
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
      ${left ? `<div class="btn-row"><button class="btn" style="--c:${t.color};--d:${t.dark}" data-act="theme-read" data-id="${id}">Lire ${Math.min(5, left)} infos de ce thème</button></div>` : ""}
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
    const pal = PALETTES.map(x => `<button class="palette ${S.palette === x.id ? "on" : ""}" data-pal="${x.id}" style="--pv-bg:${x.bg};--pv-line:${x.line};--pv-p:${x.p};--pv-d:${x.d}">
        <span class="preview"><span class="pv-dot"></span><span class="pv-line"></span><span class="pv-btn"></span></span>
        <span class="name">${x.name}<small>${x.desc}</small></span></button>`).join("");
    return `<h1>Réglages</h1><div style="height:16px"></div>
      <div class="card level"><span class="badge">${cur[2]}</span><div class="txt"><b>${cur[1]}</b>
        <p class="sub" style="margin:2px 0 8px;font-size:13px">${next ? `Encore ${plural(next[0] - n, "info")} avant « ${next[1]} »` : "Niveau maximum atteint !"}</p>
        <div class="bar" style="--tc:var(--gold)"><i style="width:${p * 100}%"></i></div></div></div>
      <h3 class="section-title">Couleurs de l'appli</h3>
      <div class="palettes">${pal}</div>
      <h3 class="section-title">Statistiques</h3>
      <div class="stats-grid">
        <div class="stat-box"><span class="e">🔥</span><div><b>${currentStreak()}</b><span>Série actuelle</span></div></div>
        <div class="stat-box"><span class="e">🏅</span><div><b>${S.bestStreak}</b><span>Record</span></div></div>
        <div class="stat-box"><span class="e">📚</span><div><b>${n}/${FACTS.length}</b><span>Infos lues</span></div></div>
        <div class="stat-box"><span class="e">⭐</span><div><b>${Object.keys(S.favs).length}</b><span>Favoris</span></div></div>
      </div>
      ${top && top[1] ? `<div class="card" style="margin-top:14px"><div class="peek">${tile(top[0])}<div class="t"><span>Thème le plus lu</span><b>${esc(top[0].name)}</b></div></div></div>` : ""}
      <h3 class="section-title">Préférences</h3>
      <div class="card"><div class="toggle-line"><b>🔊 Sons</b><button class="switch ${S.sound ? "on" : ""}" data-act="sound" aria-label="Sons"></button></div></div>
      <div class="card"><p class="tip" style="margin:0">💡 <b>Astuce :</b> raconte une info du jour à quelqu'un. L'expliquer est la meilleure façon de la retenir.</p></div>
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

  function renderCard() {
    const id = R.ids[R.i], f = factById[id], t = themeById[f.theme];
    if (R.mode !== "replay" && !S.read[id]) S.read[id] = new Date().toISOString();
    if (R.mode === "daily") S.daily.pos = Math.max(S.daily.pos, R.i + 1);
    save();
    const last = R.i === R.ids.length - 1;
    const segs = R.ids.map((_, k) => `<i class="${k < R.i ? "done" : k === R.i ? "cur" : ""}"></i>`).join("");
    $("#reader").innerHTML = `<div class="reader-inner">
        <div class="reader-top"><button class="close" data-act="close" aria-label="Fermer">✕</button>
          <div class="segments">${segs}</div><span class="counter">${R.i + 1}/${R.ids.length}</span></div>
        <div class="reader-body" id="rbody"><div class="${R.dir > 0 ? "step-enter" : "step-back"}">
          <div class="fact-card"><div class="band" style="${tv(t)}" data-icon="${t.icon}"><span class="e">${t.icon}</span>
            <div><div class="lbl">Thème</div><div class="nm">${esc(t.name)}</div></div></div>
            <div class="content"><h2>${esc(f.title)}</h2><p>${esc(f.text)}</p></div></div>
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
    if (!R || R.finished) return;
    if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "Escape") closeReader();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !R) render(); });

  applyPalette();
  render();
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
