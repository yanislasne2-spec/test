/* Pépite — apprendre une info par jour */
(() => {
  "use strict";

  const THEMES = window.THEMES;
  const FACTS = window.FACTS;
  const themeById = Object.fromEntries(THEMES.map(t => [t.id, t]));
  const factById = Object.fromEntries(FACTS.map(f => [f.id, f]));
  const INTERVALS = [1, 3, 7, 14, 30, 60]; // répétition espacée (jours)
  const KEY = "pepite-v1";

  // ---------- Dates ----------
  const dayKey = (d = new Date()) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), j = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${j}`;
  };
  const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); return dayKey(new Date(y, m - 1, d + n)); };
  const today = () => dayKey();

  // ---------- État ----------
  const defaults = () => ({
    xp: 0, streak: 0, bestStreak: 0, lastDay: null,
    days: {},          // date -> xp gagné ce jour
    learned: {},       // factId -> { at, box, due, ok, ko }
    favs: {},
    themesOff: {},
    goal: 5,
    daily: null,       // { date, ids, review, done }
    sound: true,
    installDismissed: false
  });
  let S;
  try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { S = defaults(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

  const currentStreak = () => {
    if (!S.lastDay) return 0;
    return (S.lastDay === today() || S.lastDay === addDays(today(), -1)) ? S.streak : 0;
  };

  // ---------- Hasard reproductible (même leçon toute la journée) ----------
  const seeded = (str) => {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  };
  const shuffle = (arr, rnd = Math.random) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const enabledThemes = () => { const on = THEMES.filter(t => !S.themesOff[t.id]); return on.length ? on : THEMES; };

  // Choisit n infos nouvelles en variant les thèmes
  function pickNew(n, rnd, themeIds) {
    const pool = FACTS.filter(f => themeIds.includes(f.theme) && !S.learned[f.id]);
    const byTheme = {};
    shuffle(pool, rnd).forEach(f => (byTheme[f.theme] ||= []).push(f));
    const out = [];
    let order = shuffle(Object.keys(byTheme), rnd);
    while (out.length < n && order.length) {
      order = order.filter(t => byTheme[t].length);
      for (const t of order) { if (out.length >= n) break; const f = byTheme[t].shift(); if (f) out.push(f.id); }
    }
    if (out.length < n) { // tout est appris : on reprend les plus anciennes
      const old = FACTS.filter(f => themeIds.includes(f.theme) && !out.includes(f.id))
        .sort((a, b) => (S.learned[a.id]?.at || "").localeCompare(S.learned[b.id]?.at || ""));
      out.push(...old.slice(0, n - out.length).map(f => f.id));
    }
    return out;
  }
  const dueFacts = () => Object.entries(S.learned).filter(([, v]) => v.due <= today()).sort((a, b) => a[1].due.localeCompare(b[1].due)).map(([id]) => id).filter(id => factById[id]);

  function getDaily() {
    if (!S.daily || S.daily.date !== today()) {
      const rnd = seeded("pepite" + today());
      const ids = pickNew(S.goal, rnd, enabledThemes().map(t => t.id));
      const review = dueFacts().filter(id => !ids.includes(id)).slice(0, 2);
      S.daily = { date: today(), ids, review, done: false };
      save();
    }
    return S.daily;
  }

  // ---------- Petits utilitaires d'affichage ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tv = (t) => `--tc:${t.color};--td:${t.dark}`;
  const chip = (t) => `<span class="chip" style="${tv(t)}"><span class="e">${t.icon}</span>${esc(t.name)}</span>`;
  const tile = (t) => `<span class="icon-tile" style="${tv(t)}">${t.icon}</span>`;
  const plural = (n, s, p = s + "s") => `${n} ${n > 1 ? p : s}`;

  function mascot(mood = "happy") {
    const eyes = mood === "sad"
      ? `<path d="M38 50 q6 -5 12 0" stroke="#4B3A00" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M70 50 q6 -5 12 0" stroke="#4B3A00" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : `<ellipse cx="44" cy="52" rx="7" ry="8.5" fill="#4B3A00"/><ellipse cx="76" cy="52" rx="7" ry="8.5" fill="#4B3A00"/><circle cx="46.5" cy="49" r="2.6" fill="#fff"/><circle cx="78.5" cy="49" r="2.6" fill="#fff"/>`;
    const mouth = mood === "sad"
      ? `<path d="M50 76 q10 -7 20 0" stroke="#4B3A00" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : mood === "wow"
        ? `<ellipse cx="60" cy="74" rx="8" ry="9" fill="#4B3A00"/><ellipse cx="60" cy="78" rx="5" ry="4" fill="#FF7A7A"/>`
        : `<path d="M47 68 q13 14 26 0" stroke="#4B3A00" stroke-width="4.5" fill="#fff" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<svg class="mascot" viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(0,0,0,.08)"/>
      <path d="M60 8 L102 34 L96 88 L60 108 L24 88 L18 34 Z" fill="#FFC800" stroke="#E5A800" stroke-width="5" stroke-linejoin="round"/>
      <path d="M60 8 L102 34 L60 40 L18 34 Z" fill="#FFE066"/>
      <path d="M30 30 L44 24" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="34" cy="68" rx="7" ry="4.5" fill="#FF9EAA" opacity=".7"/><ellipse cx="86" cy="68" rx="7" ry="4.5" fill="#FF9EAA" opacity=".7"/>
      ${eyes}${mouth}
    </svg>`;
  }

  function ring(p, color = "#FF9600") {
    const r = 24, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, p));
    return `<svg class="ring" viewBox="0 0 58 58"><circle cx="29" cy="29" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"/>
      <circle cx="29" cy="29" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 29 29)"/>
      <text x="29" y="34" text-anchor="middle" font-size="16">${p >= 1 ? "🔥" : "⚡"}</text></svg>`;
  }

  let toastT;
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2200); }

  function confetti() {
    const colors = ["#58CC02", "#1CB0F6", "#FFC800", "#FF4B4B", "#CE82FF", "#FF9600"];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement("i");
      c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.6 + Math.random() * 1.6 + "s";
      c.style.animationDelay = Math.random() * .4 + "s";
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4000);
    }
  }

  // ---------- Sons (synthétisés, aucun fichier) ----------
  let ac;
  function tone(notes) {
    if (!S.sound) return;
    try {
      ac ||= new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      let t = ac.currentTime;
      for (const [f, d, type = "sine", v = .18] of notes) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + d);
        o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02);
        t += d * .6;
      }
    } catch {}
  }
  const sfx = {
    tap: () => tone([[660, .06, "sine", .06]]),
    ok: () => tone([[784, .12], [1047, .22]]),
    ko: () => tone([[220, .18, "triangle", .2], [180, .25, "triangle", .2]]),
    win: () => tone([[523, .14], [659, .14], [784, .14], [1047, .4]])
  };

  // ---------- Barre du haut ----------
  function renderTop() {
    const st = currentStreak();
    $("#streak-n").textContent = st;
    $("#stat-streak").classList.toggle("dim", !(S.lastDay === today()));
    $("#xp-n").textContent = S.xp;
    $("#learned-n").textContent = Object.keys(S.learned).length;
  }

  // ---------- Vues ----------
  let tab = "home", sub = null, libFilter = "all";

  function render() {
    renderTop();
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    const v = $("#view");
    v.innerHTML = tab === "home" ? viewHome() : tab === "themes" ? (sub ? viewTheme(sub) : viewThemes()) : tab === "library" ? viewLibrary() : viewProfile();
    v.scrollTop = 0;
  }

  function weekStrip() {
    const labels = ["L", "M", "M", "J", "V", "S", "D"];
    const t = new Date(); const dow = (t.getDay() + 6) % 7;
    let html = "";
    for (let i = 0; i < 7; i++) {
      const k = addDays(today(), i - dow);
      const on = !!S.days[k];
      html += `<div class="d ${on ? "on" : ""} ${k === today() ? "today" : ""}"><i>${on ? "🔥" : ""}</i>${labels[i]}</div>`;
    }
    return `<div class="week">${html}</div>`;
  }

  function viewHome() {
    const d = getDaily();
    const facts = d.ids.map(id => factById[id]).filter(Boolean);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
    const hour = new Date().getHours();
    const hello = hour < 12 ? "Bonjour" : hour < 18 ? "Salut" : "Bonsoir";
    const st = currentStreak();
    const msg = d.done
      ? `Bravo ! Tu as appris ${plural(facts.length, "chose")} aujourd'hui. Reviens demain pour garder ta série 🔥`
      : st > 0 ? `${hello} ! Ta série est de ${plural(st, "jour")}. On continue ?` : `${hello} ! Prêt à apprendre ${plural(facts.length, "info")} en 3 minutes ?`;

    const dots = facts.map(f => { const t = themeById[f.theme]; return `<span class="theme-dot ${d.done ? "done" : ""}" style="${tv(t)}" title="${esc(t.name)}">${t.icon}</span>`; }).join("");
    const due = dueFacts().length;

    return `
      ${isIOS && !standalone && !S.installDismissed ? `
      <div class="card install-card"><button class="x" data-act="dismiss-install">×</button>
        <b>📲 Installe Pépite sur ton iPhone</b>
        <p class="tip">Dans Safari, touche <b>Partager</b> <svg class="share-ico" viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V1M4 5l4-4 4 4"/><path d="M5 8H2v11h12V8h-3"/></svg> puis <b>« Sur l'écran d'accueil »</b>. L'app s'ouvrira en plein écran, même hors connexion.</p>
      </div><div style="height:16px"></div>` : ""}
      <div class="hero">${mascot(d.done ? "wow" : "happy")}<div class="bubble">${msg}</div></div>

      <div class="card daily">
        <div class="date">${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h2>${d.done ? "Leçon du jour terminée !" : "Ta leçon du jour"}</h2>
        <div class="theme-dots">${dots}</div>
        ${d.done
          ? `<div class="btn-row"><button class="btn gold" data-act="daily-replay">Revoir les infos du jour</button>
             <button class="btn ghost" data-act="bonus">+ Leçon bonus</button></div>`
          : `<button class="btn" data-act="daily">Commencer</button>`}
      </div>

      <h3 class="section-title">Ta série</h3>
      <div class="card">
        <div class="goal">${ring(d.done ? 1 : 0)}<div class="txt"><b>${plural(st, "jour")} de suite</b><span>${d.done ? "Objectif du jour atteint ✔" : "Termine la leçon du jour pour l'allumer"}</span></div></div>
        <div style="height:14px"></div>${weekStrip()}
      </div>

      <h3 class="section-title">Révisions</h3>
      <div class="card">
        <div class="peek">${mascot("happy").replace('class="mascot"', 'class="mascot" style="width:46px;flex:none"')}
          <div class="t"><b>${due ? plural(due, "info") + " à réviser" : "Rien à réviser pour l'instant"}</b>
          <span>${due ? "Réviser au bon moment, c'est la clé pour ne pas oublier." : "Les infos apprises reviennent ici au bon moment pour bien les retenir."}</span></div></div>
        ${due ? `<div class="btn-row"><button class="btn blue" data-act="review">Réviser (${Math.min(due, 8)})</button></div>` : ""}
      </div>`;
  }

  function viewThemes() {
    const cards = THEMES.map(t => {
      const all = FACTS.filter(f => f.theme === t.id), got = all.filter(f => S.learned[f.id]).length;
      const off = !!S.themesOff[t.id];
      return `<button class="theme-card ${off ? "off" : ""}" style="${tv(t)}" data-theme="${t.id}">
        <span class="big">${t.icon}</span><span class="name">${esc(t.name)}</span>
        <div class="bar"><i style="width:${(got / all.length) * 100}%"></i></div>
        <span class="meta">${got}/${all.length} infos</span>
        ${off ? `<span class="pin" title="Exclu de la leçon du jour">🚫</span>` : ""}
      </button>`;
    }).join("");
    return `<h1>Thèmes</h1><p class="sub">Choisis ce qui t'intéresse. La leçon du jour pioche dans les thèmes activés.</p>
      <div style="height:18px"></div><div class="theme-grid">${cards}</div>`;
  }

  function viewTheme(id) {
    const t = themeById[id];
    const all = FACTS.filter(f => f.theme === id);
    const got = all.filter(f => S.learned[f.id]);
    const on = !S.themesOff[id];
    const list = all.map(f => S.learned[f.id]
      ? `<button class="fact-item" data-fact="${f.id}">${tile(t)}<div class="t"><b>${esc(f.title)}</b><span>${esc(f.text.slice(0, 90))}…</span></div>${S.favs[f.id] ? `<span class="fav">⭐</span>` : ""}</button>`
      : `<div class="fact-item locked">${tile(t)}<div class="t"><b>🔒 À découvrir</b><span>Apprends-la dans une leçon</span></div></div>`).join("");
    const left = all.length - got.length;
    return `<button class="back" data-act="back">‹ Thèmes</button>
      <div class="theme-head" style="${tv(t)}"><span class="e">${t.icon}</span><div><h1>${esc(t.name)}</h1><p>${got.length} sur ${all.length} infos apprises</p></div></div>
      <div class="card"><div class="toggle-line"><div><b>Dans ma leçon du jour</b><p class="sub" style="margin:2px 0 0;font-size:13px">Désactive pour ne plus le recevoir</p></div>
        <button class="switch ${on ? "on" : ""}" data-act="toggle-theme" data-id="${id}" aria-label="Activer le thème"></button></div></div>
      <div class="btn-row">
        ${left ? `<button class="btn" style="--c:${t.color};--d:${t.dark}" data-act="theme-lesson" data-id="${id}">Apprendre ${Math.min(3, left)} infos</button>` : ""}
        ${got.length ? `<button class="btn ghost" data-act="theme-review" data-id="${id}">Réviser ce thème</button>` : ""}
      </div>
      <h3 class="section-title">Les infos</h3>${list}`;
  }

  function viewLibrary() {
    const ids = Object.keys(S.learned).filter(id => factById[id])
      .sort((a, b) => (S.learned[b].at || "").localeCompare(S.learned[a].at || ""));
    if (!ids.length) return `<h1>Mes infos</h1><div class="empty">${mascot("happy")}<p>Tes connaissances apparaîtront ici,<br>classées par thème.</p>
      <div class="btn-row"><button class="btn" data-act="go-home">Faire ma première leçon</button></div></div>`;
    const present = THEMES.filter(t => ids.some(id => factById[id].theme === t.id));
    const filters = [`<button class="filter ${libFilter === "all" ? "on" : ""}" data-filter="all">Tout · ${ids.length}</button>`,
      `<button class="filter ${libFilter === "fav" ? "on" : ""}" style="--tc:#E5A800;--td:#B88700" data-filter="fav">⭐ Favoris</button>`,
      ...present.map(t => `<button class="filter ${libFilter === t.id ? "on" : ""}" style="${tv(t)}" data-filter="${t.id}">${t.icon} ${esc(t.name)}</button>`)].join("");
    const shown = ids.filter(id => libFilter === "all" || (libFilter === "fav" ? S.favs[id] : factById[id].theme === libFilter));
    const list = shown.map(id => { const f = factById[id], t = themeById[f.theme];
      return `<button class="fact-item" data-fact="${id}">${tile(t)}<div class="t">${chip(t)}<b style="margin-top:6px">${esc(f.title)}</b></div>${S.favs[id] ? `<span class="fav">⭐</span>` : ""}</button>`; }).join("");
    return `<h1>Mes infos</h1><p class="sub">${plural(ids.length, "info apprise", "infos apprises")} · touche une info pour la relire.</p>
      <div style="height:14px"></div><div class="filters">${filters}</div>
      ${list || `<div class="empty"><p>Aucune info ici pour l'instant.</p></div>`}`;
  }

  const LEVELS = [[0, "Curieux", "🌱"], [100, "Apprenti", "📘"], [300, "Érudit", "🎓"], [700, "Savant", "🔭"], [1200, "Sage", "🦉"], [2000, "Encyclopédie", "👑"]];
  function viewProfile() {
    let li = 0; LEVELS.forEach((l, i) => { if (S.xp >= l[0]) li = i; });
    const cur = LEVELS[li], next = LEVELS[li + 1];
    const p = next ? (S.xp - cur[0]) / (next[0] - cur[0]) : 1;
    const nLearned = Object.keys(S.learned).length;
    const favThemes = THEMES.map(t => [t, FACTS.filter(f => f.theme === t.id && S.learned[f.id]).length]).sort((a, b) => b[1] - a[1]);
    const top = favThemes[0] && favThemes[0][1] ? favThemes[0][0] : null;
    return `<h1>Profil</h1><div style="height:16px"></div>
      <div class="card level"><span class="badge">${cur[2]}</span><div class="txt"><b>${cur[1]}</b>
        <p class="sub" style="margin:2px 0 8px;font-size:13px">${next ? `${next[0] - S.xp} XP avant « ${next[1]} »` : "Niveau maximum atteint !"}</p>
        <div class="bar" style="--tc:var(--gold)"><i style="width:${p * 100}%"></i></div></div></div>
      <h3 class="section-title">Statistiques</h3>
      <div class="stats-grid">
        <div class="stat-box"><span class="e">🔥</span><div><b>${currentStreak()}</b><span>Série actuelle</span></div></div>
        <div class="stat-box"><span class="e">🏅</span><div><b>${S.bestStreak}</b><span>Record</span></div></div>
        <div class="stat-box"><span class="e">💎</span><div><b>${S.xp}</b><span>XP total</span></div></div>
        <div class="stat-box"><span class="e">📚</span><div><b>${nLearned}/${FACTS.length}</b><span>Infos apprises</span></div></div>
      </div>
      ${top ? `<div class="card" style="margin-top:14px"><div class="peek">${tile(top)}<div class="t"><span>Thème préféré</span><b>${esc(top.name)}</b></div></div></div>` : ""}
      <h3 class="section-title">Objectif quotidien</h3>
      <div class="seg">${[[3, "Tranquille"], [5, "Régulier"], [8, "Intense"]].map(([n, l]) =>
        `<button class="${S.goal === n ? "on" : ""}" data-goal="${n}">${n} infos<small>${l}</small></button>`).join("")}</div>
      <h3 class="section-title">Réglages</h3>
      <div class="card"><div class="toggle-line"><b>🔊 Sons</b><button class="switch ${S.sound ? "on" : ""}" data-act="sound" aria-label="Sons"></button></div></div>
      <div class="card"><p class="tip" style="margin:0">💡 <b>Astuce :</b> apprends le matin, révise le soir. Ton cerveau consolide pendant la nuit ce que tu as revu avant de dormir.</p></div>
      <button class="link-danger" data-act="reset">Réinitialiser ma progression</button>`;
  }

  // ---------- Leçon ----------
  // Étapes : { kind: "learn", id } | { kind: "quiz", id, review? }
  let L = null;

  function startLesson({ learn = [], quiz = [], review = [], title = "", daily = false, replay = false }) {
    const steps = learn.map(id => ({ kind: "learn", id }));
    if (!replay) steps.push(...shuffle([...quiz.map(id => ({ kind: "quiz", id })), ...review.map(id => ({ kind: "quiz", id, review: true }))]));
    L = { steps, i: 0, total: steps.length, daily, replay, title, xp: 0, ok: 0, ko: 0, combo: 0, missed: new Set(), learnIds: learn, reviewIds: review, choice: null, checked: false, snap: JSON.stringify(S.learned) };
    $("#lesson").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    renderStep();
  }

  function closeLesson() {
    $("#lesson").classList.add("hidden");
    document.body.style.overflow = "";
    L = null; render();
  }

  function renderStep() {
    const el = $("#lesson");
    if (L.i >= L.steps.length) return renderFinish();
    const s = L.steps[L.i], f = factById[s.id], t = themeById[f.theme];
    const pct = (L.i / L.steps.length) * 100;
    let body, foot;
    if (s.kind === "learn") {
      body = `<div class="kicker">${L.replay ? "À relire" : "Nouvelle info"}</div>
        <div class="fact-card"><div class="band" style="${tv(t)}"><span class="e">${t.icon}</span><div><div class="lbl">Thème</div><div class="nm">${esc(t.name)}</div></div></div>
        <div class="content"><h2>${esc(f.title)}</h2><p>${esc(f.text)}</p></div></div>
        <div class="fact-actions"><button class="fav-btn ${S.favs[f.id] ? "on" : ""}" data-act="fav" data-id="${f.id}">${S.favs[f.id] ? "⭐ En favori" : "☆ Ajouter aux favoris"}</button></div>`;
      foot = `<button class="btn" data-act="next">${L.i === L.steps.length - 1 && L.replay ? "Terminer" : "Continuer"}</button>`;
    } else {
      if (!s.order) s.order = shuffle(f.choices.map((_, k) => k));
      body = `<div class="kicker">${s.review ? "🔁 Révision" : s.retry ? "Encore une fois" : "Question"}</div>${chip(t)}
        <h2 class="question">${esc(f.q)}</h2>
        <div class="choices">${s.order.map((k, n) => `<button class="choice" data-choice="${k}"><span class="k">${n + 1}</span>${esc(f.choices[k])}</button>`).join("")}</div>`;
      foot = `<button class="btn disabled" data-act="check">Vérifier</button>`;
    }
    el.innerHTML = `<div class="lesson-inner">
      <div class="lesson-top"><button class="close" data-act="quit" aria-label="Quitter">✕</button>
        <div class="progress"><i style="width:${pct}%"></i></div><span class="combo">${L.combo >= 2 ? "🔥" + L.combo : ""}</span></div>
      <div class="lesson-body"><div class="step-enter">${body}</div></div></div>
      <div class="lesson-foot" id="foot"><div class="inner">${foot}</div></div>`;
    L.choice = null; L.checked = false;
  }

  function check() {
    const s = L.steps[L.i], f = factById[s.id];
    const ok = L.choice === f.a;
    L.checked = true;
    document.querySelectorAll(".choice").forEach(b => {
      b.classList.add("locked"); const k = +b.dataset.choice;
      if (k === f.a) b.classList.add("right"); else if (k === L.choice) { b.classList.remove("sel"); b.classList.add("wrong"); }
    });
    const foot = $("#foot");
    if (ok) {
      L.ok++; L.combo++;
      const gain = s.retry ? 5 : 10; L.xp += gain;
      sfx.ok();
      const praise = ["Bien joué !", "Excellent !", "Parfait !", "Bravo !", "Super !"][Math.floor(Math.random() * 5)];
      foot.className = "lesson-foot ok";
      foot.innerHTML = `<div class="inner"><div class="feedback"><span class="fi">✅</span><div><b>${praise}</b><span>+${gain} XP${L.combo >= 3 ? ` · ${L.combo} d'affilée 🔥` : ""}</span></div></div>
        <button class="btn" data-act="next">Continuer</button></div>`;
      if (!s.retry) srs(s.id, !L.missed.has(s.id));
    } else {
      L.ko++; L.combo = 0; L.missed.add(s.id);
      sfx.ko();
      foot.className = "lesson-foot ko";
      foot.innerHTML = `<div class="inner"><div class="feedback"><span class="fi">💡</span><div><b>Bonne réponse :</b><span>${esc(f.choices[f.a])}</span></div></div>
        <button class="btn red" data-act="next">Compris</button></div>`;
      if (!s.retry) srs(s.id, false);
      L.steps.push({ kind: "quiz", id: s.id, retry: true });
    }
    $(".combo").textContent = L.combo >= 2 ? "🔥" + L.combo : "";
  }

  // Répétition espacée (boîtes de Leitner)
  function srs(id, good) {
    const e = S.learned[id] || { at: today(), box: 0, ok: 0, ko: 0 };
    if (good) { e.box = Math.min(e.box + (S.learned[id] ? 1 : 0), INTERVALS.length - 1); e.ok++; }
    else { e.box = 0; e.ko++; }
    e.due = addDays(today(), INTERVALS[e.box]);
    if (!S.learned[id]) e.at = new Date().toISOString();
    S.learned[id] = e;
  }

  function renderFinish() {
    // On marque comme apprises les infos lues (même en relecture)
    L.learnIds.forEach(id => { if (!S.learned[id]) srs(id, true); });
    if (L.daily && !L.replay) { S.daily.done = true; L.xp += 10; }
    const acc = L.ok + L.ko ? Math.round((L.ok / (L.ok + L.ko)) * 100) : 100;
    const firstToday = S.lastDay !== today();
    if (!L.replay) {
      S.xp += L.xp;
      S.days[today()] = (S.days[today()] || 0) + L.xp;
      if (firstToday) {
        S.streak = S.lastDay === addDays(today(), -1) ? S.streak + 1 : 1;
        S.lastDay = today();
        S.bestStreak = Math.max(S.bestStreak, S.streak);
      }
    }
    save();
    sfx.win(); confetti();
    const learned = L.learnIds.map(id => factById[id]);
    $("#lesson").innerHTML = `<div class="lesson-inner"><div class="lesson-body finish">
        ${mascot("wow")}
        <h1>${L.replay ? "Bien relu !" : L.daily ? "Leçon du jour terminée !" : "Leçon terminée !"}</h1>
        ${!L.replay && firstToday ? `<p class="sub">🔥 Série : ${plural(S.streak, "jour")} !</p>` : ""}
        ${L.replay ? "" : `<div class="result-row">
          <div class="result" style="--rc:#FFC800"><div class="h">XP gagnés</div><div class="v">💎 ${L.xp}</div></div>
          <div class="result" style="--rc:#58CC02"><div class="h">Précision</div><div class="v">🎯 ${acc}%</div></div>
          <div class="result" style="--rc:#1CB0F6"><div class="h">Infos</div><div class="v">📚 ${learned.length + L.reviewIds.length}</div></div></div>`}
        ${learned.length ? `<div class="card learned-list"><b>${L.replay ? "Infos du jour" : "Tu as appris"}</b>
          ${learned.map(f => { const t = themeById[f.theme]; return `<div class="row">${tile(t)}<span>${esc(f.title)}</span></div>`; }).join("")}</div>` : ""}
      </div></div>
      <div class="lesson-foot"><div class="inner"><button class="btn" data-act="done">Continuer</button></div></div>`;
  }

  // Lecture d'une info depuis la bibliothèque
  function openFact(id) { startLesson({ learn: [id], replay: true }); }

  // ---------- Événements ----------
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const act = b.dataset.act;

    if (b.dataset.tab) { sfx.tap(); tab = b.dataset.tab; sub = null; render(); window.scrollTo(0, 0); return; }
    if (b.dataset.theme) { sfx.tap(); sub = b.dataset.theme; render(); window.scrollTo(0, 0); return; }
    if (b.dataset.fact) { sfx.tap(); openFact(b.dataset.fact); return; }
    if (b.dataset.filter) { sfx.tap(); libFilter = b.dataset.filter; render(); return; }
    if (b.dataset.goal) {
      sfx.tap(); S.goal = +b.dataset.goal;
      if (S.daily && S.daily.date === today() && !S.daily.done) S.daily = null; // on régénère la leçon
      save(); render(); toast(`Objectif : ${S.goal} infos par jour`); return;
    }
    if (b.dataset.choice !== undefined && L && !L.checked) {
      sfx.tap();
      document.querySelectorAll(".choice").forEach(c => c.classList.toggle("sel", c === b));
      L.choice = +b.dataset.choice;
      const cb = $('[data-act="check"]'); if (cb) cb.classList.remove("disabled");
      return;
    }

    switch (act) {
      case "daily": { const d = getDaily(); startLesson({ learn: d.ids, quiz: d.ids, review: d.review, daily: true }); break; }
      case "daily-replay": startLesson({ learn: getDaily().ids, replay: true }); break;
      case "bonus": {
        const ids = pickNew(3, Math.random, enabledThemes().map(t => t.id));
        startLesson({ learn: ids, quiz: ids }); break;
      }
      case "review": { const ids = dueFacts().slice(0, 8); startLesson({ review: ids }); break; }
      case "theme-lesson": { const ids = pickNew(3, Math.random, [b.dataset.id]).filter(id => !S.learned[id]); startLesson({ learn: ids, quiz: ids }); break; }
      case "theme-review": {
        const ids = shuffle(Object.keys(S.learned).filter(id => factById[id]?.theme === b.dataset.id)).slice(0, 8);
        startLesson({ review: ids }); break;
      }
      case "toggle-theme": {
        const id = b.dataset.id;
        if (!S.themesOff[id] && enabledThemes().length <= 1) { toast("Garde au moins un thème activé"); break; }
        S.themesOff[id] ? delete S.themesOff[id] : (S.themesOff[id] = true);
        if (S.daily && S.daily.date === today() && !S.daily.done) S.daily = null;
        save(); render(); break;
      }
      case "back": sub = null; render(); break;
      case "go-home": tab = "home"; render(); break;
      case "dismiss-install": S.installDismissed = true; save(); render(); break;
      case "sound": S.sound = !S.sound; save(); render(); sfx.tap(); break;
      case "reset":
        if (confirm("Effacer toute ta progression (XP, série, infos apprises) ?")) { S = defaults(); save(); render(); toast("Progression réinitialisée"); }
        break;
      case "fav": {
        const id = b.dataset.id; S.favs[id] ? delete S.favs[id] : (S.favs[id] = true); save();
        b.classList.toggle("on", !!S.favs[id]); b.textContent = S.favs[id] ? "⭐ En favori" : "☆ Ajouter aux favoris";
        if (S.favs[id]) sfx.ok(); break;
      }
      case "check": if (L && L.choice !== null) check(); break;
      case "next": sfx.tap(); L.i++; renderStep(); break;
      case "quit":
        if (L.replay || L.i === 0 || confirm("Quitter la leçon ? Ta progression dans cette leçon sera perdue.")) { S.learned = JSON.parse(L.snap); closeLesson(); }
        break;
      case "done": closeLesson(); break;
    }
  });

  // Raccourcis clavier (pratique sur ordinateur)
  document.addEventListener("keydown", (e) => {
    if (!L) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) { const c = document.querySelectorAll(".choice")[n - 1]; if (c) c.click(); }
    if (e.key === "Enter") { const b = $("#lesson .lesson-foot .btn:not(.disabled)"); if (b) b.click(); }
  });

  // Nouveau jour pendant que l'app reste ouverte
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !L) render(); });

  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
