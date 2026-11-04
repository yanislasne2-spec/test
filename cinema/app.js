/* Éveil — le Système du cinéphile
   To-do list de films / séries / culture, avec XP, niveaux, rangs, quêtes journalières, portails et donjons. */
(() => {
  "use strict";

  const KEY = "eveil-v1";
  const CAT = { film: { name: "Films", one: "Film", ico: "🎬" }, serie: { name: "Séries", one: "Série", ico: "📺" }, culture: { name: "Culture", one: "Culture", ico: "🧠" } };
  const ERA = { classique: "Classique", actuel: "Actuel", futur: "Futur culte" };
  const RANKS = ["E", "D", "C", "B", "A", "S"];
  const RANK_XP = { E: 60, D: 90, C: 130, B: 180, A: 250, S: 350 };
  const RANK_HINT = { E: "facile, court", D: "accessible", C: "standard", B: "long ou dense", A: "exigeant", S: "monument" };
  const DUNGEON_XP = { E: 200, D: 250, C: 350, B: 450, A: 600, S: 800 };
  const GATE_MULT = 1.5;

  // ---------- Dates ----------
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); return dayKey(new Date(y, m - 1, d + n)); };
  const today = () => dayKey();
  const weekKey = (d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dayKey(x); }; // lundi
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } };

  // Aléatoire déterministe (même quêtes / portail toute la journée)
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => { let a = hash(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  // ---------- État ----------
  const defaults = () => ({
    name: "",
    xp: 0,
    items: {},          // id -> { status: todo|doing|done, added, started, done, rating, note, xp, gate }
    custom: [],         // titres ajoutés à la main
    daily: null,        // { date, quests: [{ id, p, done }], bonus }
    weekly: null,       // { week, p, done }
    gate: null,         // { date, id, rerolls, accepted }
    gatesCleared: 0,
    streak: 0, bestStreak: 0, lastActive: null,
    titles: {},         // titleId -> date
    equipped: null,
    dungeons: {},       // dungeonId -> date terminé
    sound: true,
    installDismissed: false,
    created: new Date().toISOString()
  });
  let S;
  try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = defaults(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  // ---------- Catalogue ----------
  const catalog = () => window.CATALOG.concat(S.custom);
  let byId = {};
  const reindex = () => { byId = Object.fromEntries(catalog().map(x => [x.id, x])); };
  reindex();
  const rec = (id) => S.items[id];
  const statusOf = (id) => (S.items[id] && S.items[id].status) || null;
  const doneList = () => Object.entries(S.items).filter(([id, r]) => r.status === "done" && byId[id]).map(([id, r]) => ({ it: byId[id], r }));

  // ---------- Niveaux & rangs ----------
  const need = (lvl) => 50 + 12 * lvl;            // XP pour passer du niveau lvl à lvl+1
  const levelInfo = (xp) => {
    let lvl = 1, rest = Math.max(0, xp);
    while (rest >= need(lvl)) { rest -= need(lvl); lvl++; }
    return { lvl, cur: rest, next: need(lvl) };
  };
  const RANK_TIERS = [
    { r: "E", min: 1, name: "Chasseur de rang E" },
    { r: "D", min: 10, name: "Chasseur de rang D" },
    { r: "C", min: 20, name: "Chasseur de rang C" },
    { r: "B", min: 30, name: "Chasseur de rang B" },
    { r: "A", min: 45, name: "Chasseur de rang A" },
    { r: "S", min: 60, name: "Chasseur de rang S" },
    { r: "L", min: 80, name: "Légende du cinéma" }
  ];
  const tierOf = (lvl) => RANK_TIERS.slice().reverse().find(t => lvl >= t.min);

  // ---------- Quêtes ----------
  const QUESTS = [
    { id: "add2", text: "Ajoute 2 titres à ta liste", ev: "add", n: 2, xp: 30 },
    { id: "view3", text: "Consulte 3 fiches dans Explorer", ev: "view", n: 3, xp: 20 },
    { id: "classic", text: "Ouvre la fiche d'un classique d'avant 1980", ev: "viewOld", n: 1, xp: 25 },
    { id: "culture", text: "Ajoute un titre Culture à ta liste", ev: "addCulture", n: 1, xp: 30 },
    { id: "start", text: "Commence un titre (« En cours »)", ev: "start", n: 1, xp: 30 },
    { id: "gate", text: "Accepte le Portail du jour", ev: "gate", n: 1, xp: 30 },
    { id: "rate", text: "Note un titre vu (étoiles)", ev: "rate", n: 1, xp: 30 },
    { id: "review", text: "Écris une critique (30 caractères min.)", ev: "review", n: 1, xp: 40 },
    { id: "done", text: "Termine un film, une série ou un doc", ev: "done", n: 1, xp: 80 },
    { id: "dungeon", text: "Ajoute un titre d'un donjon à ta liste", ev: "addDungeon", n: 1, xp: 25 },
    { id: "series", text: "Ajoute une série à ta liste", ev: "addSerie", n: 1, xp: 25 }
  ];
  const questById = Object.fromEntries(QUESTS.map(q => [q.id, q]));
  const DAILY_BONUS = 100;
  const WEEKLY = { text: "Termine 3 titres cette semaine", n: 3, xp: 300 };

  const ensureDaily = () => {
    const d = today();
    if (S.daily && S.daily.date === d) return;
    // Série : a-t-on accompli au moins une quête hier ?
    if (S.lastActive && S.lastActive !== d && S.lastActive !== addDays(d, -1)) S.streak = 0;
    const r = rng("q" + d + (S.created || ""));
    const pool = QUESTS.slice();
    const picked = [];
    while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
    S.daily = { date: d, quests: picked.map(id => ({ id, p: 0, done: false })), bonus: false };
    if (!S.weekly || S.weekly.week !== weekKey()) S.weekly = { week: weekKey(), p: 0, done: false };
    save();
  };

  // ---------- Portail du jour ----------
  const ensureGate = (force) => {
    const d = today();
    if (!force && S.gate && S.gate.date === d) return;
    const prev = S.gate && S.gate.date === d ? S.gate : null;
    const candidates = catalog().filter(x => !statusOf(x.id) && (!prev || x.id !== prev.id));
    if (!candidates.length) { S.gate = null; save(); return; }
    const r = rng("g" + d + (S.created || "") + (prev ? prev.rerolls + 1 : 0));
    const pick = candidates[Math.floor(r() * candidates.length)];
    S.gate = { date: d, id: pick.id, rerolls: prev ? prev.rerolls + 1 : 0, accepted: false };
    save();
  };

  // ---------- Stats ----------
  const computeStats = () => {
    const done = doneList();
    const genres = new Set(done.map(x => x.it.g));
    const cnt = (f) => done.filter(f).length;
    return [
      { k: "HÉR", name: "Héritage", desc: "classiques terminés", v: 10 + 3 * cnt(x => x.it.era === "classique" && x.it.cat !== "culture") },
      { k: "FLR", name: "Flair", desc: "actuels & futurs cultes", v: 10 + 3 * cnt(x => x.it.era === "actuel" && x.it.cat !== "culture") + 4 * cnt(x => x.it.era === "futur" && x.it.cat !== "culture") },
      { k: "END", name: "Endurance", desc: "séries terminées", v: 10 + 5 * cnt(x => x.it.cat === "serie") },
      { k: "SAV", name: "Savoir", desc: "titres Culture", v: 10 + 4 * cnt(x => x.it.cat === "culture") },
      { k: "ÉCL", name: "Éclectisme", desc: "genres différents", v: 10 + 4 * genres.size },
      { k: "PLM", name: "Plume", desc: "critiques écrites", v: 10 + 3 * done.filter(x => (x.r.note || "").trim().length >= 30).length }
    ];
  };

  // ---------- Titres (succès) ----------
  const TITLES = [
    { id: "eveille", name: "L'Éveillé", desc: "Terminer ton premier titre", ok: (c) => c.done >= 1 },
    { id: "assidu", name: "Assidu", desc: "10 titres terminés", ok: (c) => c.done >= 10 },
    { id: "accompli", name: "Cinéphile accompli", desc: "50 titres terminés", ok: (c) => c.done >= 50 },
    { id: "centurion", name: "Centurion", desc: "100 titres terminés", ok: (c) => c.done >= 100 },
    { id: "rat", name: "Rat de cinémathèque", desc: "10 classiques terminés", ok: (c) => c.classique >= 10 },
    { id: "pepites", name: "Chasseur de pépites", desc: "5 futurs cultes terminés", ok: (c) => c.futur >= 5 },
    { id: "marathon", name: "Marathonien", desc: "5 séries terminées", ok: (c) => c.serie >= 5 },
    { id: "encyclo", name: "Encyclopédiste", desc: "8 titres Culture terminés", ok: (c) => c.culture >= 8 },
    { id: "plume", name: "Plume acérée", desc: "10 critiques écrites", ok: (c) => c.reviews >= 10 },
    { id: "rangS", name: "Briseur de monuments", desc: "3 titres de rang S terminés", ok: (c) => c.rankS >= 3 },
    { id: "portails", name: "Briseur de portails", desc: "5 Portails accomplis", ok: () => S.gatesCleared >= 5 },
    { id: "discipline", name: "Discipline de fer", desc: "7 jours d'éveil d'affilée", ok: () => S.bestStreak >= 7 },
    { id: "conquerant", name: "Conquérant", desc: "Terminer un donjon", ok: () => Object.keys(S.dungeons).length >= 1 },
    { id: "seigneur", name: "Seigneur des donjons", desc: "Terminer 5 donjons", ok: () => Object.keys(S.dungeons).length >= 5 },
    { id: "elite", name: "Chasseur d'élite", desc: "Atteindre le niveau 30", ok: (c) => c.lvl >= 30 },
    { id: "legende", name: "Légende vivante", desc: "Atteindre le niveau 60", ok: (c) => c.lvl >= 60 }
  ];
  const counts = () => {
    const done = doneList();
    return {
      done: done.length,
      classique: done.filter(x => x.it.era === "classique").length,
      futur: done.filter(x => x.it.era === "futur").length,
      serie: done.filter(x => x.it.cat === "serie").length,
      culture: done.filter(x => x.it.cat === "culture").length,
      reviews: done.filter(x => (x.r.note || "").trim().length >= 30).length,
      rankS: done.filter(x => x.it.rank === "S").length,
      lvl: levelInfo(S.xp).lvl
    };
  };

  // ---------- Sons (synthétisés, aucun fichier) ----------
  let actx = null, touched = false;
  addEventListener("pointerdown", () => { touched = true; if (actx && actx.state === "suspended") actx.resume(); }, { capture: true });
  const tone = (freq, start, dur, type = "sine", vol = 0.08) => {
    if (!S.sound || !touched) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      const t = actx.currentTime + start, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  };
  const sfx = {
    tap: () => tone(880, 0, 0.06, "triangle", 0.03),
    quest: () => { tone(660, 0, 0.18, "triangle"); tone(990, 0.09, 0.25, "triangle"); },
    clear: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.35, "triangle", 0.07)); },
    level: () => { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.09, 0.5, "sawtooth", 0.035)); tone(1568, 0.6, 0.9, "sine", 0.06); },
    gate: () => { tone(110, 0, 0.9, "sawtooth", 0.04); tone(220, 0.05, 0.8, "sine", 0.05); tone(330, 0.3, 0.6, "sine", 0.04); }
  };

  // ---------- Fenêtres du Système (file d'attente) ----------
  const sysQueue = [];
  let sysOpen = false;
  const $sys = document.getElementById("system");
  const system = (o) => { sysQueue.push(o); if (!sysOpen) nextSystem(); };
  const nextSystem = () => {
    const o = sysQueue.shift();
    if (!o) { sysOpen = false; $sys.classList.add("hidden"); return; }
    sysOpen = true;
    $sys.className = "system " + (o.kind || "");
    $sys.innerHTML = `<div class="sys-win">
        <div class="sys-head"><span class="sys-ico">!</span> SYSTÈME</div>
        <div class="sys-title">${o.title}</div>
        ${o.big ? `<div class="sys-big">${o.big}</div>` : ""}
        ${o.body ? `<div class="sys-body">${o.body}</div>` : ""}
        <button class="btn sys-ok">${o.ok || "Confirmer"}</button>
      </div>`;
    (o.sound || sfx.quest)();
    $sys.querySelector(".sys-ok").onclick = () => { sfx.tap(); nextSystem(); };
  };

  const toast = (msg) => {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  };

  // ---------- Gains d'XP ----------
  const gainXP = (n, reason) => {
    if (!n) return;
    const before = levelInfo(S.xp).lvl;
    S.xp = Math.max(0, S.xp + n);
    const after = levelInfo(S.xp).lvl;
    if (n > 0 && reason) toast(`+${n} XP · ${reason}`);
    if (after > before) {
      const tb = tierOf(before), ta = tierOf(after);
      system({ kind: "level", title: "NIVEAU SUPÉRIEUR", big: `Nv. ${after}`, body: `Tes statistiques de cinéphile ont augmenté.`, ok: "Continuer", sound: sfx.level });
      if (ta.r !== tb.r) system({ kind: "rank rank-" + ta.r, title: "RÉÉVALUATION DU RANG", big: ta.r === "L" ? "★" : ta.r, body: `Tu es désormais <b>${ta.name}</b>.`, ok: "Accepter", sound: sfx.level });
    }
    save();
  };

  const markActive = () => {
    const d = today();
    if (S.lastActive === d) return;
    S.streak = S.lastActive === addDays(d, -1) ? S.streak + 1 : 1;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    S.lastActive = d;
  };

  // Un événement fait avancer les quêtes
  const emit = (ev, n = 1) => {
    ensureDaily();
    S.daily.quests.forEach(q => {
      const def = questById[q.id];
      if (q.done || def.ev !== ev) return;
      q.p = Math.min(def.n, q.p + n);
      if (q.p >= def.n) {
        q.done = true; markActive();
        system({ title: "QUÊTE ACCOMPLIE", body: `${def.text}<div class="sys-reward">+${def.xp} XP</div>` });
        gainXP(def.xp);
      }
    });
    if (!S.daily.bonus && S.daily.quests.every(q => q.done)) {
      S.daily.bonus = true;
      system({ kind: "level", title: "QUÊTES JOURNALIÈRES TERMINÉES", body: `Récompense de discipline<div class="sys-reward">+${DAILY_BONUS} XP</div>`, sound: sfx.clear });
      gainXP(DAILY_BONUS);
    }
    if (ev === "done") {
      if (!S.weekly || S.weekly.week !== weekKey()) S.weekly = { week: weekKey(), p: 0, done: false };
      if (!S.weekly.done) {
        S.weekly.p = Math.min(WEEKLY.n, S.weekly.p + n);
        if (S.weekly.p >= WEEKLY.n) {
          S.weekly.done = true;
          system({ kind: "level", title: "QUÊTE HEBDOMADAIRE ACCOMPLIE", body: `${WEEKLY.text}<div class="sys-reward">+${WEEKLY.xp} XP</div>`, sound: sfx.clear });
          gainXP(WEEKLY.xp);
        }
      }
    }
    save();
  };

  const checkUnlocks = () => {
    // Donjons
    window.DUNGEONS.forEach(d => {
      if (S.dungeons[d.id]) return;
      if (d.items.length && d.items.every(id => statusOf(id) === "done")) {
        S.dungeons[d.id] = new Date().toISOString();
        const xp = DUNGEON_XP[d.rank];
        system({ kind: "rank rank-" + d.rank, title: "DONJON NETTOYÉ", big: d.icon, body: `<b>${d.name}</b><br>Titre obtenu : « ${d.reward} »<div class="sys-reward">+${xp} XP</div>`, sound: sfx.clear });
        S.titles["d-" + d.id] = new Date().toISOString();
        gainXP(xp);
      }
    });
    // Titres
    const c = counts();
    TITLES.forEach(t => {
      if (S.titles[t.id] || !t.ok(c)) return;
      S.titles[t.id] = new Date().toISOString();
      if (!S.equipped) S.equipped = t.id;
      system({ title: "TITRE DÉBLOQUÉ", big: "✦", body: `« <b>${t.name}</b> »<br><small>${t.desc}</small>`, sound: sfx.clear });
    });
    save();
  };
  const allTitles = () => TITLES.map(t => ({ id: t.id, name: t.name, desc: t.desc }))
    .concat(window.DUNGEONS.map(d => ({ id: "d-" + d.id, name: d.reward, desc: `Terminer « ${d.name} »` })));
  const titleName = (id) => { const t = allTitles().find(x => x.id === id); return t ? t.name : null; };

  // ---------- Actions sur les titres ----------
  const addToList = (id, silent) => {
    if (statusOf(id)) return;
    const it = byId[id];
    S.items[id] = { status: "todo", added: new Date().toISOString() };
    if (!silent) toast(`Ajouté à ta liste : ${it.t}`);
    emit("add");
    if (it.cat === "culture") emit("addCulture");
    if (it.cat === "serie") emit("addSerie");
    if (window.DUNGEONS.some(d => d.items.includes(id))) emit("addDungeon");
    save();
  };
  const startItem = (id) => {
    if (!statusOf(id)) addToList(id, true);
    const r = rec(id);
    if (r.status === "done") return;
    r.status = "doing"; r.started = new Date().toISOString();
    toast(`En cours : ${byId[id].t}`);
    emit("start"); save();
  };
  const removeItem = (id) => {
    const r = rec(id);
    if (!r) return;
    if (r.status === "done" && r.xp) gainXP(-r.xp);
    delete S.items[id];
    save();
  };
  const isGateActive = (id) => S.gate && S.gate.id === id && S.gate.accepted;

  const completeItem = (id, rating, note) => {
    if (!statusOf(id)) S.items[id] = { status: "todo", added: new Date().toISOString() };
    const r = rec(id), it = byId[id];
    const base = RANK_XP[it.rank] || RANK_XP.C;
    const gate = isGateActive(id) || r.gate;
    let xp = Math.round(base * (gate ? GATE_MULT : 1));
    if (rating) xp += 10;
    if ((note || "").trim().length >= 30) xp += 20;
    Object.assign(r, { status: "done", done: new Date().toISOString(), rating: rating || 0, note: (note || "").trim(), xp });
    markActive();
    let body = `<b>${esc(it.t)}</b><br><small>Rang ${it.rank} · ${CAT[it.cat].one}</small><div class="sys-reward">+${xp} XP</div>`;
    if (gate) { body += `<small>Bonus Portail ×${GATE_MULT}</small>`; S.gatesCleared++; if (S.gate && S.gate.id === id) S.gate.cleared = true; }
    system({ kind: "rank rank-" + it.rank, title: "CIBLE ÉLIMINÉE", body, ok: "Récupérer", sound: sfx.clear });
    gainXP(xp);
    emit("done");
    if (rating) emit("rate");
    if ((note || "").trim().length >= 30) emit("review");
    checkUnlocks();
    save();
  };
  const updateReview = (id, rating, note) => {
    const r = rec(id);
    if (!r || r.status !== "done") return;
    const hadRating = !!r.rating, hadReview = (r.note || "").length >= 30;
    r.rating = rating || 0; r.note = (note || "").trim();
    let bonus = 0;
    if (!hadRating && r.rating) { bonus += 10; emit("rate"); }
    if (!hadReview && r.note.length >= 30) { bonus += 20; emit("review"); }
    if (bonus) { r.xp += bonus; gainXP(bonus, "critique"); }
    checkUnlocks(); save();
  };

  // ---------- Rendu : utilitaires ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $view = document.getElementById("view");
  const coverStyle = (it) => {
    const h = hash(it.t) % 360;
    return `background: radial-gradient(120% 90% at 20% 10%, hsl(${h} 70% 38%), transparent 60%), linear-gradient(160deg, hsl(${(h + 40) % 360} 55% 18%), hsl(${(h + 200) % 360} 50% 8%));`;
  };
  const initials = (t) => t.replace(/[«»"'():!?,.]/g, "").split(/\s+/).filter(w => w.length > 2 || /^[A-Z0-9]/.test(w)).slice(0, 2).map(w => w[0]).join("").toUpperCase() || t[0];
  const cover = (it, cls = "") => `<div class="cover ${cls}" style="${coverStyle(it)}"><span class="cover-ini">${esc(initials(it.t))}</span><span class="cover-cat">${CAT[it.cat].ico}</span></div>`;
  const rankBadge = (r, cls = "") => `<span class="rank r-${r} ${cls}">${r}</span>`;
  const stars = (n) => n ? `<span class="stars">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>` : "";
  const stateBtn = (id) => {
    const st = statusOf(id);
    if (st === "done") return `<button class="state done" data-act="open" data-id="${id}" aria-label="Vu">✓</button>`;
    if (st) return `<button class="state listed" data-act="complete" data-id="${id}" aria-label="Marquer comme vu">${st === "doing" ? "▶" : "○"}</button>`;
    return `<button class="state" data-act="add" data-id="${id}" aria-label="Ajouter">＋</button>`;
  };
  const row = (it, extra = "") => `
    <div class="row" data-act="open" data-id="${it.id}">
      ${cover(it)}
      <div class="row-main">
        <div class="row-title">${esc(it.t)}</div>
        <div class="row-sub">${it.y || ""}${it.by ? " · " + esc(it.by) : ""}</div>
        <div class="row-tags">${rankBadge(it.rank)}<span class="tag era-${it.era}">${ERA[it.era] || ""}</span><span class="tag">${esc(it.g || CAT[it.cat].one)}</span>${extra}</div>
      </div>
      ${stateBtn(it.id)}
    </div>`;

  // ---------- Vue : Statut ----------
  const viewStatus = () => {
    ensureDaily(); ensureGate();
    const L = levelInfo(S.xp), tier = tierOf(L.lvl), stats = computeStats();
    const pct = Math.round(100 * L.cur / L.next);
    const g = S.gate && byId[S.gate.id];
    const done = doneList().length, todo = Object.values(S.items).filter(r => r.status !== "done").length;
    const install = !S.installDismissed && /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone;
    return `
      ${install ? `<div class="panel install"><b>Installe Éveil sur ton iPhone</b><br>Dans Safari : bouton <b>Partager</b> ⎙ → <b>Sur l'écran d'accueil</b>.<button class="x" data-act="dismissInstall">✕</button></div>` : ""}
      <section class="panel status-win">
        <div class="win-head">STATUT</div>
        <div class="hunter">
          <div class="big-rank r-${tier.r}">${tier.r === "L" ? "★" : tier.r}</div>
          <div class="hunter-info">
            <div class="hunter-name" data-act="rename">${esc(S.name || "Chasseur sans nom")} <span class="pen">✎</span></div>
            <div class="hunter-title">${S.equipped ? "« " + esc(titleName(S.equipped)) + " »" : "Aucun titre"}</div>
            <div class="hunter-tier">${tier.name}</div>
          </div>
          <div class="lvl"><small>NIVEAU</small><b>${L.lvl}</b></div>
        </div>
        <div class="xpbar"><div style="width:${pct}%"></div></div>
        <div class="xp-txt"><span>XP ${L.cur} / ${L.next}</span><span>Total ${S.xp}</span></div>
        <div class="stats-grid">
          ${stats.map(s => `<div class="stat"><span class="stat-k">${s.k}</span><b>${s.v}</b><small>${s.name}</small></div>`).join("")}
        </div>
        <div class="mini-counts"><span><b>${done}</b> terminés</span><span><b>${todo}</b> dans ta liste</span><span><b>${Object.keys(S.dungeons).length}</b>/${window.DUNGEONS.length} donjons</span></div>
      </section>

      <section class="panel">
        <div class="win-head">QUÊTES JOURNALIÈRES <small>se renouvellent à minuit</small></div>
        ${S.daily.quests.map(q => { const d = questById[q.id]; return `
          <div class="quest ${q.done ? "ok" : ""}">
            <span class="check">${q.done ? "✓" : ""}</span>
            <div class="q-main"><div>${d.text}</div><small>${q.p} / ${d.n}</small></div>
            <span class="q-xp">+${d.xp}</span>
          </div>`; }).join("")}
        <div class="quest bonus ${S.daily.bonus ? "ok" : ""}"><span class="check">${S.daily.bonus ? "✓" : "★"}</span><div class="q-main"><div>Récompense : toutes les quêtes du jour</div></div><span class="q-xp">+${DAILY_BONUS}</span></div>
        <div class="quest weekly ${S.weekly.done ? "ok" : ""}"><span class="check">${S.weekly.done ? "✓" : "⟳"}</span><div class="q-main"><div>Hebdo : ${WEEKLY.text}</div><small>${S.weekly.p} / ${WEEKLY.n}</small></div><span class="q-xp">+${WEEKLY.xp}</span></div>
        ${S.streak ? `<div class="streak-note">🔥 ${S.streak} jour${S.streak > 1 ? "s" : ""} d'éveil d'affilée (record ${S.bestStreak})</div>` : `<div class="streak-note muted">Accomplis une quête par jour pour lancer ta série 🔥</div>`}
      </section>

      ${g ? `
      <section class="panel gate-panel r-${g.rank}">
        <div class="win-head">PORTAIL DU JOUR <small>XP ×${GATE_MULT}</small></div>
        <div class="gate">
          <div class="gate-ring r-${g.rank}"><span>${g.rank}</span></div>
          <div class="gate-info" data-act="open" data-id="${g.id}">
            <div class="row-title">${esc(g.t)}</div>
            <div class="row-sub">${CAT[g.cat].ico} ${CAT[g.cat].one} · ${g.y || ""} · ${esc(g.d || "")}</div>
            <div class="gate-p">${esc(g.p || "")}</div>
          </div>
        </div>
        ${S.gate.cleared ? `<div class="gate-done">Portail fermé. Reviens demain.</div>` :
          S.gate.accepted ? `<div class="gate-done">Portail accepté : termine ce titre pour gagner ×${GATE_MULT} XP.</div>` :
          `<div class="btn-row"><button class="btn primary" data-act="acceptGate">Entrer dans le Portail</button>${S.gate.rerolls < 1 ? `<button class="btn ghost" data-act="rerollGate">Autre portail</button>` : ""}</div>`}
      </section>` : ""}
    `;
  };

  // ---------- Vue : Ma liste ----------
  let listTab = "todo", listCat = "all";
  const viewList = () => {
    const entries = Object.entries(S.items).filter(([id]) => byId[id]).map(([id, r]) => ({ it: byId[id], r }))
      .filter(x => listCat === "all" || x.it.cat === listCat);
    let body;
    if (listTab === "todo") {
      const doing = entries.filter(x => x.r.status === "doing").sort((a, b) => (b.r.started || "").localeCompare(a.r.started || ""));
      const todo = entries.filter(x => x.r.status === "todo").sort((a, b) => (b.r.added || "").localeCompare(a.r.added || ""));
      body = (doing.length ? `<h3 class="sec">En cours</h3>${doing.map(x => row(x.it, isGateActive(x.it.id) ? `<span class="tag gate-tag">Portail</span>` : "")).join("")}` : "") +
        (todo.length ? `<h3 class="sec">À voir</h3>${todo.map(x => row(x.it, isGateActive(x.it.id) ? `<span class="tag gate-tag">Portail</span>` : "")).join("")}` : "");
      if (!doing.length && !todo.length) body = `<div class="empty">Ta liste est vide.<br>Va dans <b>Explorer</b> et touche ＋ pour ajouter des films, séries et documentaires.<br><br><button class="btn primary" data-act="go" data-tab="explore">Explorer le catalogue</button></div>`;
    } else {
      const done = entries.filter(x => x.r.status === "done").sort((a, b) => (b.r.done || "").localeCompare(a.r.done || ""));
      body = done.length ? done.map(x => row(x.it, `${stars(x.r.rating)}<span class="tag">+${x.r.xp || 0} XP</span>`)).join("") : `<div class="empty">Rien de terminé pour l'instant.<br>Touche le rond ○ à côté d'un titre de ta liste quand tu l'as vu.</div>`;
    }
    const nTodo = entries.filter(x => x.r.status !== "done").length, nDone = entries.filter(x => x.r.status === "done").length;
    return `
      <div class="seg">
        <button class="${listTab === "todo" ? "on" : ""}" data-act="listTab" data-v="todo">À voir <b>${nTodo}</b></button>
        <button class="${listTab === "done" ? "on" : ""}" data-act="listTab" data-v="done">Vus <b>${nDone}</b></button>
      </div>
      <div class="chips">${[["all", "Tout"], ["film", "🎬 Films"], ["serie", "📺 Séries"], ["culture", "🧠 Culture"]].map(([v, l]) => `<button class="chip ${listCat === v ? "on" : ""}" data-act="listCat" data-v="${v}">${l}</button>`).join("")}</div>
      <div class="list">${body}</div>
      <button class="btn ghost wide" data-act="addCustom">＋ Ajouter un titre qui n'est pas dans le catalogue</button>`;
  };

  // ---------- Vue : Explorer ----------
  let exCat = "film", exEra = "all", exQuery = "", exHide = false, exRank = "all";
  const viewExplore = () => {
    const q = exQuery.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    let items = catalog().filter(x => (q ? true : x.cat === exCat));
    if (q) items = items.filter(x => norm(x.t).includes(q) || norm(x.by).includes(q) || norm(x.g).includes(q) || String(x.y).includes(q));
    if (exEra !== "all") items = items.filter(x => x.era === exEra);
    if (exRank !== "all") items = items.filter(x => x.rank === exRank);
    if (exHide) items = items.filter(x => !statusOf(x.id));
    const order = { classique: 0, actuel: 1, futur: 2 };
    items.sort((a, b) => (order[a.era] - order[b.era]) || (a.y - b.y));
    const total = catalog().filter(x => x.cat === exCat).length, seen = catalog().filter(x => x.cat === exCat && statusOf(x.id) === "done").length;
    return `
      <div class="search"><span>⌕</span><input id="ex-q" type="search" placeholder="Titre, réalisateur, genre, année…" value="${esc(exQuery)}" autocomplete="off"></div>
      ${q ? "" : `<div class="seg three">${Object.entries(CAT).map(([k, c]) => `<button class="${exCat === k ? "on" : ""}" data-act="exCat" data-v="${k}">${c.ico} ${c.name}</button>`).join("")}</div>
      <div class="progress-line"><span>${seen} / ${total} vus</span><div class="pbar"><div style="width:${total ? 100 * seen / total : 0}%"></div></div></div>`}
      <div class="chips">${[["all", "Toutes époques"], ["classique", "Classiques"], ["actuel", "Actuels"], ["futur", "Futurs cultes"]].map(([v, l]) => `<button class="chip ${exEra === v ? "on" : ""}" data-act="exEra" data-v="${v}">${l}</button>`).join("")}</div>
      <div class="chips">${["all"].concat(RANKS).map(r => `<button class="chip ${exRank === r ? "on" : ""}" data-act="exRank" data-v="${r}">${r === "all" ? "Tous rangs" : "Rang " + r}</button>`).join("")}
        <button class="chip ${exHide ? "on" : ""}" data-act="exHide">Masquer ma liste</button></div>
      <div class="list">${items.length ? items.map(it => row(it)).join("") : `<div class="empty">Aucun titre trouvé.</div>`}</div>
      <button class="btn ghost wide" data-act="addCustom">＋ Ajouter un titre perso</button>`;
  };

  // ---------- Vue : Donjons ----------
  const viewDungeons = () => `
    <p class="intro">Termine tous les titres d'un donjon pour le nettoyer : gros bonus d'XP et un titre exclusif.</p>
    ${window.DUNGEONS.map(d => {
      const n = d.items.filter(id => statusOf(id) === "done").length, cleared = !!S.dungeons[d.id];
      return `<section class="panel dungeon ${cleared ? "cleared" : ""}" data-act="dungeon" data-id="${d.id}">
        <div class="d-ico">${d.icon}</div>
        <div class="d-main">
          <div class="d-name">${esc(d.name)} ${rankBadge(d.rank)}</div>
          <div class="d-desc">${esc(d.desc)}</div>
          <div class="pbar"><div style="width:${100 * n / d.items.length}%"></div></div>
          <div class="d-meta"><span>${n} / ${d.items.length}</span><span>${cleared ? "✓ Nettoyé" : `+${DUNGEON_XP[d.rank]} XP · « ${esc(d.reward)} »`}</span></div>
        </div>
      </section>`;
    }).join("")}`;

  // ---------- Vue : Profil ----------
  const viewProfile = () => {
    const ts = allTitles();
    const c = counts();
    const byCat = (k) => doneList().filter(x => x.it.cat === k).length;
    return `
      <section class="panel">
        <div class="win-head">TITRES <small>${Object.keys(S.titles).length} / ${ts.length}</small></div>
        <p class="muted small">Touche un titre débloqué pour l'équiper.</p>
        <div class="titles">${ts.map(t => { const has = !!S.titles[t.id]; return `<button class="title-chip ${has ? "has" : ""} ${S.equipped === t.id ? "eq" : ""}" ${has ? `data-act="equip" data-id="${t.id}"` : ""}><b>${has ? esc(t.name) : "???"}</b><small>${esc(t.desc)}</small></button>`; }).join("")}</div>
      </section>
      <section class="panel">
        <div class="win-head">CHRONIQUE</div>
        <div class="kv"><span>Films vus</span><b>${byCat("film")}</b></div>
        <div class="kv"><span>Séries terminées</span><b>${byCat("serie")}</b></div>
        <div class="kv"><span>Culture & docs</span><b>${byCat("culture")}</b></div>
        <div class="kv"><span>Critiques écrites</span><b>${c.reviews}</b></div>
        <div class="kv"><span>Portails accomplis</span><b>${S.gatesCleared}</b></div>
        <div class="kv"><span>Meilleure série</span><b>${S.bestStreak} j</b></div>
      </section>
      <section class="panel">
        <div class="win-head">RÉGLAGES</div>
        <div class="kv"><span>Sons du Système</span><button class="toggle ${S.sound ? "on" : ""}" data-act="sound"><span></span></button></div>
        <div class="kv"><span>Nom du chasseur</span><button class="btn small ghost" data-act="rename">Modifier</button></div>
        <p class="muted small">Ta progression est enregistrée sur ce téléphone. Fais une sauvegarde de temps en temps (ou pour changer de téléphone).</p>
        <div class="btn-row"><button class="btn ghost" data-act="export">Exporter</button><button class="btn ghost" data-act="import">Importer</button></div>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <button class="btn danger wide" data-act="reset">Réinitialiser ma progression</button>
      </section>
      <section class="panel how">
        <div class="win-head">RÈGLES DU SYSTÈME</div>
        <p>• Chaque titre a un <b>rang</b> (E → S) selon sa durée et son exigence. Terminer un titre rapporte de l'XP : ${RANKS.map(r => `${r} ${RANK_XP[r]}`).join(" · ")}. Bonus +10 si tu le notes, +20 si tu écris une critique.</p>
        <p>• <b>Quêtes journalières</b> : 3 par jour, +${DAILY_BONUS} XP si tu les fais toutes. Une quête hebdo en plus.</p>
        <p>• <b>Portail du jour</b> : un titre tiré au hasard. Accepte-le puis termine-le pour ×${GATE_MULT} XP.</p>
        <p>• <b>Rangs du chasseur</b> : E (nv 1), D (10), C (20), B (30), A (45), S (60), Légende (80).</p>
        <p>• <b>Stats</b> : Héritage (classiques), Flair (récents), Endurance (séries), Savoir (culture), Éclectisme (genres), Plume (critiques).</p>
      </section>
      <p class="credits">Éveil · le Système du cinéphile</p>`;
  };

  // ---------- Fiches (bottom sheet) ----------
  const $wrap = document.getElementById("sheet-wrap"), $sheet = document.getElementById("sheet");
  const openSheet = (html) => { $sheet.innerHTML = `<div class="grab"></div>` + html; $wrap.classList.remove("hidden"); requestAnimationFrame(() => $wrap.classList.add("open")); $sheet.scrollTop = 0; };
  const closeSheet = () => { $wrap.classList.remove("open"); setTimeout(() => { $wrap.classList.add("hidden"); $sheet.innerHTML = ""; }, 250); };
  $wrap.querySelector(".sheet-backdrop").onclick = closeSheet;

  const openItem = (id, fromExplore) => {
    const it = byId[id]; if (!it) return;
    if (fromExplore) { emit("view"); if (it.y && it.y < 1980) emit("viewOld"); }
    const r = rec(id), st = r && r.status;
    const dungeons = window.DUNGEONS.filter(d => d.items.includes(id));
    const xp = Math.round(RANK_XP[it.rank] * (isGateActive(id) ? GATE_MULT : 1));
    const jw = `https://www.justwatch.com/fr/recherche?q=${encodeURIComponent(it.t.replace(/\s*\(.*?\)\s*/g, " ").trim())}`;
    openSheet(`
      <div class="detail-head">${cover(it, "big")}
        <div>
          <div class="d-cat">${CAT[it.cat].ico} ${CAT[it.cat].one} · ${ERA[it.era] || ""}</div>
          <h2>${esc(it.t)}</h2>
          <div class="row-sub">${it.y || ""}${it.by ? " · " + esc(it.by) : ""}</div>
          <div class="row-tags">${rankBadge(it.rank)}<span class="tag">${esc(it.g || "")}</span>${it.d ? `<span class="tag">⏱ ${esc(it.d)}</span>` : ""}</div>
        </div>
      </div>
      ${it.p ? `<p class="pitch">${esc(it.p)}</p>` : ""}
      <div class="reward-line">Récompense : <b>${xp} XP</b> <small>(rang ${it.rank} · ${RANK_HINT[it.rank]})</small>${isGateActive(id) ? ` <span class="tag gate-tag">Portail ×${GATE_MULT}</span>` : ""}</div>
      ${dungeons.length ? `<div class="d-in">Fait partie de : ${dungeons.map(d => `<b>${d.icon} ${esc(d.name)}</b>`).join(", ")}</div>` : ""}
      ${st === "done" ? `
        <div class="done-box">
          <div class="done-head">✓ Vu le ${fmtDate(r.done)} · +${r.xp || 0} XP</div>
          ${starPicker(r.rating)}
          <textarea id="note" rows="4" placeholder="Ta critique, ce que tu as retenu…">${esc(r.note || "")}</textarea>
          <button class="btn primary wide" data-act="saveReview" data-id="${id}">Enregistrer</button>
        </div>` : `
        <div class="btn-col">
          <button class="btn primary wide" data-act="complete" data-id="${id}">✓ Je l'ai vu</button>
          ${!st ? `<button class="btn wide" data-act="add" data-id="${id}">＋ Ajouter à ma liste</button>` : ""}
          ${st !== "doing" ? `<button class="btn ghost wide" data-act="start" data-id="${id}">▶ Je commence</button>` : ""}
        </div>`}
      <a class="btn ghost wide link" href="${jw}" target="_blank" rel="noopener">Où le regarder ? (JustWatch) ↗</a>
      ${st ? `<button class="btn danger-text wide" data-act="remove" data-id="${id}">${st === "done" ? "Retirer des vus (l'XP sera retirée)" : "Retirer de ma liste"}</button>` : ""}
      ${it.custom ? `<button class="btn danger-text wide" data-act="deleteCustom" data-id="${id}">Supprimer ce titre perso</button>` : ""}
    `);
  };

  const starPicker = (n = 0) => `<div class="star-pick" id="stars" data-v="${n}">${[1, 2, 3, 4, 5].map(i => `<button data-act="star" data-v="${i}" class="${i <= n ? "on" : ""}">★</button>`).join("")}</div>`;

  const openComplete = (id) => {
    const it = byId[id]; if (!it) return;
    openSheet(`
      <div class="win-head center">RAPPORT DE MISSION</div>
      <h2 class="center">${esc(it.t)}</h2>
      <p class="center muted">Ta note (+10 XP)</p>
      ${starPicker(0)}
      <textarea id="note" rows="4" placeholder="Une critique en quelques mots (30 caractères min. pour +20 XP)…"></textarea>
      <button class="btn primary wide" data-act="confirmComplete" data-id="${id}">Valider · +${Math.round(RANK_XP[it.rank] * (isGateActive(id) ? GATE_MULT : 1))} XP</button>
      <button class="btn ghost wide" data-act="close">Annuler</button>`);
  };

  const openDungeon = (did) => {
    const d = window.DUNGEONS.find(x => x.id === did); if (!d) return;
    const n = d.items.filter(id => statusOf(id) === "done").length;
    openSheet(`
      <div class="dungeon-head"><div class="d-ico big">${d.icon}</div><div><h2>${esc(d.name)}</h2><div class="row-sub">${esc(d.desc)}</div>
      <div class="row-tags">${rankBadge(d.rank)}<span class="tag">${n} / ${d.items.length}</span><span class="tag">+${DUNGEON_XP[d.rank]} XP</span></div></div></div>
      <p class="muted small">Récompense : le titre « ${esc(d.reward)} ».</p>
      <div class="list">${d.items.map(id => byId[id]).filter(Boolean).map(it => row(it)).join("")}</div>
      ${d.items.some(id => !statusOf(id)) ? `<button class="btn primary wide" data-act="addAllDungeon" data-id="${d.id}">＋ Tout ajouter à ma liste</button>` : ""}`);
  };

  const openCustom = () => {
    openSheet(`
      <div class="win-head center">NOUVELLE CIBLE</div>
      <label class="field">Titre<input id="c-t" type="text" placeholder="Ex. : Le Mépris"></label>
      <label class="field">Catégorie<select id="c-cat">${Object.entries(CAT).map(([k, c]) => `<option value="${k}">${c.ico} ${c.one}</option>`).join("")}</select></label>
      <div class="two">
        <label class="field">Année<input id="c-y" type="number" inputmode="numeric" placeholder="1963"></label>
        <label class="field">Genre<input id="c-g" type="text" placeholder="Drame"></label>
      </div>
      <label class="field">Réalisateur·rice / créateur·rice<input id="c-by" type="text" placeholder="Jean-Luc Godard"></label>
      <label class="field">Rang (difficulté)<select id="c-r">${RANKS.map(r => `<option value="${r}" ${r === "C" ? "selected" : ""}>${r} — ${RANK_HINT[r]} (${RANK_XP[r]} XP)</option>`).join("")}</select></label>
      <button class="btn primary wide" data-act="saveCustom">Ajouter à ma liste</button>`);
  };

  // ---------- Navigation ----------
  let tab = "status";
  const VIEWS = { status: viewStatus, list: viewList, explore: viewExplore, dungeons: viewDungeons, profile: viewProfile };
  const render = (keepScroll) => {
    const y = window.scrollY;
    $view.innerHTML = VIEWS[tab]();
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    const L = levelInfo(S.xp), tier = tierOf(L.lvl);
    const rp = document.getElementById("rank-pill");
    rp.textContent = `${tier.r === "L" ? "★" : tier.r} · Nv ${L.lvl}`; rp.className = "pill rank-pill r-" + tier.r;
    document.getElementById("streak-n").textContent = S.streak;
    window.scrollTo(0, keepScroll ? y : 0);
    const q = document.getElementById("ex-q");
    if (q) q.oninput = (e) => { exQuery = e.target.value; const pos = e.target.selectionStart; render(true); const n = document.getElementById("ex-q"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} };
    const f = document.getElementById("import-file");
    if (f) f.onchange = importFile;
  };
  const go = (t) => { tab = t; render(); };
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => { sfx.tap(); go(b.dataset.tab); });

  // Rafraîchir la fiche ouverte + la vue après une action
  const refresh = (reopenId) => { render(true); if (reopenId && !$wrap.classList.contains("hidden")) openItem(reopenId); };

  // ---------- Sauvegarde ----------
  const exportData = () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `eveil-sauvegarde-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Sauvegarde exportée");
  };
  const importFile = (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== "object" || !("items" in data)) throw new Error("format");
        if (!confirm("Remplacer ta progression actuelle par cette sauvegarde ?")) return;
        S = Object.assign(defaults(), data); save(); reindex(); render(); toast("Sauvegarde importée");
      } catch (er) { toast("Fichier de sauvegarde invalide"); }
    };
    reader.readAsText(file);
  };

  // ---------- Clics ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act, id = el.dataset.id, v = el.dataset.v;
    const inSheet = !!el.closest("#sheet");
    if (act !== "open" && act !== "star") sfx.tap();
    switch (act) {
      case "open": e.stopPropagation(); sfx.tap(); openItem(id, tab === "explore" && !inSheet); break;
      case "add": e.stopPropagation(); addToList(id); refresh(inSheet ? id : null); break;
      case "start": startItem(id); refresh(id); break;
      case "complete": e.stopPropagation(); openComplete(id); break;
      case "confirmComplete": {
        const rating = +document.getElementById("stars").dataset.v || 0, note = document.getElementById("note").value;
        closeSheet(); completeItem(id, rating, note); render(true); break;
      }
      case "saveReview": {
        updateReview(id, +document.getElementById("stars").dataset.v || 0, document.getElementById("note").value);
        toast("Critique enregistrée"); closeSheet(); render(true); break;
      }
      case "star": {
        const box = el.parentElement, cur = +box.dataset.v, nv = cur === +v ? 0 : +v;
        box.dataset.v = nv; box.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i < nv)); tone(500 + nv * 120, 0, 0.08, "triangle", 0.04); break;
      }
      case "remove": {
        const r = rec(id);
        if (r && r.status === "done" && !confirm(`Retirer « ${byId[id].t} » des vus ? Les ${r.xp || 0} XP gagnés seront retirés.`)) break;
        removeItem(id); closeSheet(); render(true); break;
      }
      case "close": closeSheet(); break;
      case "go": go(el.dataset.tab); break;
      case "listTab": listTab = v; render(); break;
      case "listCat": listCat = v; render(true); break;
      case "exCat": exCat = v; render(); break;
      case "exEra": exEra = v; render(true); break;
      case "exRank": exRank = v; render(true); break;
      case "exHide": exHide = !exHide; render(true); break;
      case "dungeon": openDungeon(id); break;
      case "addAllDungeon": { const d = window.DUNGEONS.find(x => x.id === id); let n = 0; d.items.forEach(i => { if (!statusOf(i)) { addToList(i, true); n++; } }); toast(`${n} titre${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}`); render(true); openDungeon(id); break; }
      case "acceptGate": {
        if (!S.gate) break;
        S.gate.accepted = true;
        if (!statusOf(S.gate.id)) addToList(S.gate.id, true);
        rec(S.gate.id).gate = true;
        const g = byId[S.gate.id];
        system({ kind: "rank rank-" + g.rank, title: "PORTAIL OUVERT", big: g.rank, body: `Cible : <b>${esc(g.t)}</b><br><small>Termine-la pour gagner ×${GATE_MULT} XP. Elle a été ajoutée à ta liste.</small>`, ok: "Entrer", sound: sfx.gate });
        emit("gate"); save(); render(true); break;
      }
      case "rerollGate": ensureGate(true); render(true); break;
      case "rename": {
        const n = prompt("Ton nom de chasseur :", S.name || "");
        if (n !== null) { S.name = n.trim().slice(0, 24); save(); render(true); }
        break;
      }
      case "equip": S.equipped = id; save(); render(true); toast(`Titre équipé : ${titleName(id)}`); break;
      case "sound": S.sound = !S.sound; save(); render(true); break;
      case "export": exportData(); break;
      case "import": document.getElementById("import-file").click(); break;
      case "reset":
        if (confirm("Tout effacer : liste, XP, titres, donjons ? (Exporte une sauvegarde avant si besoin.)")) { S = defaults(); save(); reindex(); render(); toast("Progression réinitialisée"); }
        break;
      case "dismissInstall": S.installDismissed = true; save(); render(true); break;
      case "addCustom": openCustom(); break;
      case "saveCustom": {
        const t = document.getElementById("c-t").value.trim();
        if (!t) { toast("Indique un titre"); break; }
        const y = +document.getElementById("c-y").value || null;
        const it = { id: "u-" + Date.now().toString(36), custom: true, cat: document.getElementById("c-cat").value, t, y,
          by: document.getElementById("c-by").value.trim(), g: document.getElementById("c-g").value.trim(),
          era: !y ? "actuel" : y < 2007 ? "classique" : y < 2023 ? "actuel" : "futur", rank: document.getElementById("c-r").value, d: "", p: "" };
        S.custom.push(it); reindex(); addToList(it.id); closeSheet(); render(true); break;
      }
      case "deleteCustom":
        if (confirm("Supprimer ce titre perso ?")) { removeItem(id); S.custom = S.custom.filter(x => x.id !== id); reindex(); save(); closeSheet(); render(true); }
        break;
    }
  });

  // ---------- Démarrage ----------
  ensureDaily(); ensureGate();
  render();
  if (!S.name && !localStorage.getItem(KEY + "-welcomed")) {
    try { localStorage.setItem(KEY + "-welcomed", "1"); } catch (e) {}
    system({ title: "TU AS ÉTÉ CHOISI", big: "◆", body: "Le Système du cinéphile s'éveille.<br><br>Ajoute des films, séries et documentaires à ta liste, termine-les pour gagner de l'XP, monte de niveau et grimpe du rang <b>E</b> au rang <b>S</b>.<br><br>Chaque jour : 3 quêtes et un Portail.", ok: "Accepter", sound: sfx.gate });
  }
  // Nouveau jour pendant que l'appli est ouverte
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.daily && S.daily.date !== today()) { ensureDaily(); ensureGate(); render(true); } });
})();
