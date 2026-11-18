/* UNIQLO × JOLAGREEN — lecteur « Dynamic Island » + petites interactions communes */
(function () {
  var TRACKS = [
    ['800€', 'Jolagreen23 · +99XP'],
    ['12HEURES MINUIT', 'Jolagreen23'],
    ['GANGTAKA', 'Jolagreen23'],
    ['DRAGON2KOMODO', 'Jolagreen23'],
    ['LOCKED UP', 'Jolagreen23 feat. Tiakola'],
    ['2319', 'Jolagreen23 feat. La Mano 1.9']
  ];
  var island = document.querySelector('.island');
  if (island) {
    var i = 0;
    try { i = +sessionStorage.getItem('jola_piste') || 0; } catch (e) {}
    var t1 = island.querySelector('.t1'), t2 = island.querySelector('.t2'),
        art = island.querySelector('.art'), num = island.querySelector('.num');
    function show() {
      t1.textContent = t2.textContent = TRACKS[i][0];
      art.textContent = TRACKS[i][1];
      num.textContent = 'PISTE 0' + (i + 1) + '/06';
      try { sessionStorage.setItem('jola_piste', i); } catch (e) {}
    }
    show();
    island.addEventListener('click', function (e) {
      if (!island.classList.contains('open')) { island.classList.add('open'); e.stopPropagation(); }
    });
    island.querySelector('.close').addEventListener('click', function (e) { e.stopPropagation(); island.classList.remove('open'); });
    island.querySelector('.prev').addEventListener('click', function (e) { e.stopPropagation(); i = (i + 5) % 6; show(); });
    island.querySelector('.next').addEventListener('click', function (e) { e.stopPropagation(); i = (i + 1) % 6; show(); });
    island.querySelector('.pp').addEventListener('click', function (e) { e.stopPropagation(); island.classList.toggle('playing'); });
    document.addEventListener('click', function (e) { if (!island.contains(e.target)) island.classList.remove('open'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') island.classList.remove('open'); });
  }
  /* tailles : un seul choix actif */
  document.querySelectorAll('.pp-taille').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      g.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });
  /* ================= PANIER (enregistré dans le navigateur) ================= */
  var KEY = 'jola_panier';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
  function count(c) { return c.reduce(function (n, x) { return n + x.qty; }, 0); }
  function eur(v) { return v.toFixed(2).replace('.', ',') + ' €'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function refreshCount(bump) {
    var n = count(load());
    document.querySelectorAll('.panier i').forEach(function (i) {
      i.textContent = n;
      if (bump) { i.classList.remove('bump'); void i.offsetWidth; i.classList.add('bump'); }
    });
  }
  refreshCount();
  addEventListener('storage', function (e) { if (e.key === KEY) refreshCount(); });

  /* notification « ajouté au panier » */
  var toast, toastT;
  function notify(p) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.innerHTML = '<img src="' + esc(p.img) + '" alt=""><div class="tx"><b>✓ Ajouté au panier</b><span>' + esc(p.name) + '</span><small>Taille ' + esc(p.size) + ' · ' + eur(p.price) + '</small></div><a href="panier.html">VOIR LE PANIER</a>';
    toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('show'); }, 3500);
  }

  /* boutons « ajouter au panier » des fiches produits */
  document.querySelectorAll('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var p = JSON.parse(btn.getAttribute('data-add'));
      var on = document.querySelector('.pp-taille button.on');
      p.size = on ? on.textContent.trim() : 'Unique';
      if (p.size === 'UNIQUE') p.size = 'Unique';
      var c = load(), key = p.id + '|' + p.size, found = null;
      c.forEach(function (x) { if (x.key === key) found = x; });
      if (found) found.qty++; else c.push({ key: key, id: p.id, name: p.name, img: p.img, price: p.price, color: p.color, size: p.size, qty: 1 });
      save(c); refreshCount(true); notify(p);
    });
  });

  /* page panier */
  var bag = document.getElementById('bag-items');
  if (bag) {
    var promo = 0;
    var page = document.querySelector('.pan');
    function render() {
      var c = load(), n = count(c);
      document.getElementById('bag-n').textContent = n;
      page.classList.toggle('is-empty', !c.length);
      bag.innerHTML = c.map(function (x, i) {
        return '<div class="item"><div class="th"><img src="' + esc(x.img) + '" alt="' + esc(x.name) + '"></div><div><div class="nm">' + esc(x.name) + '</div>' +
          '<dl><dt>Taille :</dt><dd>' + esc(x.size) + '</dd><dt>Couleur :</dt><dd>' + esc(x.color) + '</dd><dt>Quantité :</dt><dd><span class="qty"><button type="button" data-q="-1" data-i="' + i + '" aria-label="Retirer un">−</button>' + x.qty + '<button type="button" data-q="1" data-i="' + i + '" aria-label="Ajouter un">+</button></span></dd></dl>' +
          '<a class="rm" href="#" data-rm="' + i + '">Retirer</a></div><div class="pr">' + eur(x.price * x.qty) + '</div></div>';
      }).join('');
      var sub = c.reduce(function (s, x) { return s + x.price * x.qty; }, 0);
      var express = document.querySelector('input[name="liv"][value="express"]');
      var liv = c.length && express && express.checked ? 9.9 : 0;
      var rem = Math.round(sub * promo * 100) / 100;
      document.getElementById('s-sub').textContent = eur(sub);
      document.getElementById('s-liv').textContent = liv ? eur(liv) : 'Gratuite';
      document.getElementById('s-rem').textContent = (rem ? '− ' : '') + eur(rem);
      document.getElementById('s-tot').textContent = eur(sub + liv - rem);
      document.querySelector('.pay-btn').disabled = !c.length;
      refreshCount();
    }
    bag.addEventListener('click', function (e) {
      var t = e.target.closest('[data-q],[data-rm]'); if (!t) return;
      e.preventDefault();
      var c = load();
      if (t.hasAttribute('data-rm')) c.splice(+t.getAttribute('data-rm'), 1);
      else { var x = c[+t.getAttribute('data-i')]; x.qty += +t.getAttribute('data-q'); if (x.qty < 1) c.splice(+t.getAttribute('data-i'), 1); }
      save(c); render();
    });
    document.querySelectorAll('input[name="liv"]').forEach(function (r) { r.addEventListener('change', render); });
    document.getElementById('promo-btn').addEventListener('click', function () {
      var f = this.parentNode.querySelector('input');
      if (f.value.trim().toUpperCase() === 'JOLA23') { promo = .1; this.textContent = '−10 % APPLIQUÉ'; }
      else { promo = 0; this.textContent = 'CODE INVALIDE'; var b = this; setTimeout(function () { b.textContent = 'APPLIQUER'; }, 1600); }
      render();
    });
    document.getElementById('checkout').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!load().length) return;
      save([]); promo = 0; render();
      var btn = this.querySelector('.pay-btn'); btn.disabled = true;
      btn.textContent = 'COMMANDE VALIDÉE ✓ — MERCI !';
    });
    addEventListener('storage', function (e) { if (e.key === KEY) render(); });
    render();
  }

  /* lien « retour » */
  document.querySelectorAll('[data-back]').forEach(function (a) {
    a.addEventListener('click', function (e) { if (history.length > 1) { e.preventDefault(); history.back(); } });
  });
})();
