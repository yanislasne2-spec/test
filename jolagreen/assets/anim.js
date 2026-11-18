/* UNIQLO × JOLAGREEN — couche d'animations (transitions, apparitions, 3D, favoris, vol vers le panier…)
   Tout est coupé si l'utilisateur préfère réduire les animations. */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var touch = matchMedia('(hover: none)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var body = document.body;

  /* ---------- transition de sortie vers les autres pages du site ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:)/.test(href) || a.hasAttribute('data-back')) return;
    e.preventDefault();
    body.classList.add('pt-out');
    setTimeout(function () { location.href = href; }, 480);
  });
  addEventListener('pageshow', function (e) { if (e.persisted) body.classList.remove('pt-out'); });

  /* ---------- découpe d'un titre en lettres animées ---------- */
  function split(el, base) {
    var i = base || 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (word) {
            if (!word) return;
            if (/^\s+$/.test(word)) { frag.appendChild(document.createTextNode(word)); return; }
            var w = document.createElement('span'); w.className = 'w';
            word.split('').forEach(function (c) {
              var s = document.createElement('span'); s.className = 'ch'; s.textContent = c; s.style.setProperty('--i', i++); w.appendChild(s);
            });
            frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    })(el);
    el.setAttribute('aria-label', el.textContent);
  }
  $$('.coll h1, .pan .head h1, .prj .hero h1').forEach(function (h) { split(h); });
  $$('.manif h2, .ftr .word').forEach(function (h) { split(h); h.setAttribute('data-rv', ''); h.style.opacity = 1; h.style.transform = 'none'; });

  /* ---------- apparitions au défilement ---------- */
  var groups = [
    '.coll .lab, .coll .sub, .coll .desc, .coll .tool',
    '.cgrid .tile', '.pan .head .lab, .pan .head p', '.checkout > *', '.bag > h2, .promo, .sum, .total, .tva',
    '.prj .hero .lab, .prj .hero .intro, .prj .portrait', '.s1 > *', '.s2 > .lab, .s2 > h2, .s2 > p', '.vals > div', '.s3 > .lab, .s3 > h2', '.albums > .album',
    '.ftr .links a, .ftr .orig, .ftr .socials a, .ftr .capsule, .ftr .badge, .ftr .legal'
  ];
  groups.forEach(function (sel) {
    $$(sel).forEach(function (el, k) { el.setAttribute('data-rv', ''); el.style.setProperty('--d', Math.min(k, 8) * 0.08 + 's'); });
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('[data-rv]').forEach(function (el) { io.observe(el); });

  /* ---------- bandeau défilant sur « Le projet » ---------- */
  var s3 = $('.s3');
  if (s3) {
    var m = document.createElement('div'); m.className = 'marq'; m.setAttribute('aria-hidden', 'true');
    var t = 'R&amp;D <em>✦</em> 99XP <em>✦</em> GOTY EDITION <em>✦</em> UNIQLO × JOLAGREEN23 <em>✦</em> ';
    m.innerHTML = '<span>' + t + t + '</span><span>' + t + t + '</span>';
    s3.parentNode.insertBefore(m, s3);
  }

  /* ---------- cartes inclinables en 3D avec reflet ---------- */
  if (!touch) {
    $$('.cgrid .tile .ph, .pp-card, .album').forEach(function (el) {
      el.classList.add('tilt');
      var g = document.createElement('span'); g.className = 'glare'; el.appendChild(g);
      var max = el.classList.contains('pp-card') ? 6 : 8;
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.classList.add('on');
        el.style.setProperty('--ry', ((x - 0.5) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - y) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      });
      el.addEventListener('mouseleave', function () { el.classList.remove('on'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });

    /* parallaxe du fond des fiches produits */
    var bg = $('.pp-bg'), hero = $('.pp');
    if (bg && hero) hero.addEventListener('mousemove', function (e) {
      bg.style.setProperty('--px', ((e.clientX / innerWidth - 0.5) * -24).toFixed(1) + 'px');
      bg.style.setProperty('--py', ((e.clientY / innerHeight - 0.5) * -16).toFixed(1) + 'px');
    });

    /* boutons aimantés */
    $$('.pp-buy, .pay-btn, .manif a, .ftr .socials a, .promo button').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px)';
      });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; });
    });
  }

  /* ---------- texte brouillé façon jeu vidéo au survol ---------- */
  var GLYPHS = '01#%&@$▓▒░<>/\\=+*';
  $$('.hdr .tabs a, .hdr .back, .pp-tabs a, .pp-brand .bk, .tile .meta b, .coll .tool span:not(.sp), .album .go, .pan .foot a').forEach(function (el) {
    var orig = el.textContent, timer = null;
    el.addEventListener('mouseenter', function () {
      var f = 0; clearInterval(timer);
      timer = setInterval(function () {
        el.textContent = orig.split('').map(function (c, i) {
          if (c === ' ' || i < f) return c;
          return GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }).join('');
        f += Math.max(1, orig.length / 12);
        if (f >= orig.length) { clearInterval(timer); el.textContent = orig; }
      }, 32);
    });
  });

  /* ---------- favoris (cœurs) avec petite explosion ---------- */
  var FKEY = 'jola_favoris', favs = {};
  try { favs = JSON.parse(localStorage.getItem(FKEY)) || {}; } catch (e) {}
  $$('.tile .fav').forEach(function (h) {
    var tile = h.closest('.tile'), id = (tile.querySelector('.meta b') || {}).textContent || '';
    if (favs[id]) h.classList.add('on');
    h.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      h.classList.toggle('on'); favs[id] = h.classList.contains('on');
      try { localStorage.setItem(FKEY, JSON.stringify(favs)); } catch (er) {}
      h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop');
      if (h.classList.contains('on')) burst(e.clientX, e.clientY, 10);
    });
  });
  function burst(x, y, n) {
    for (var i = 0; i < n; i++) {
      var d = document.createElement('span'); d.className = 'burst'; document.body.appendChild(d);
      var a = (Math.PI * 2 * i) / n, r = 26 + Math.random() * 18;
      d.style.left = x - 3 + 'px'; d.style.top = y - 3 + 'px';
      d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * r + 'px,' + Math.sin(a) * r + 'px) scale(.2)', opacity: 0 }],
        { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = (function (el) { return function () { el.remove(); }; })(d);
    }
  }

  /* ---------- le produit vole jusqu'au panier ---------- */
  $$('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.classList.remove('added'); void btn.offsetWidth; btn.classList.add('added');
      var src = $('.pp-card img'), dst = $('.panier i');
      if (!src || !dst) return;
      var a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
      var w = Math.min(a.width, 220), h = w * a.height / a.width;
      var f = document.createElement('img'); f.src = src.currentSrc || src.src; f.className = 'fly'; f.alt = '';
      f.style.cssText += 'left:' + (a.left + (a.width - w) / 2) + 'px;top:' + (a.top + (a.height - h) / 2) + 'px;width:' + w + 'px;height:' + h + 'px';
      document.body.appendChild(f);
      var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      f.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + dx * 0.45 + 'px,' + (dy * 0.45 - 120) + 'px) scale(.55) rotate(-8deg)', opacity: 1, offset: 0.5 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.06) rotate(10deg)', opacity: 0.3 }
      ], { duration: 900, easing: 'cubic-bezier(.45,0,.2,1)' }).onfinish = function () { f.remove(); burst(b.left + b.width / 2, b.top + b.height / 2, 8); };
    });
  });

  /* ---------- compteur 01 / 05 qui défile ---------- */
  var cnt = $('.pp-count b');
  if (cnt) {
    var target = +cnt.textContent, k = 0;
    cnt.textContent = '00';
    setTimeout(function tick() { cnt.textContent = ('0' + k).slice(-2); if (k++ < target) setTimeout(tick, 90); }, 1250);
  }

  /* ---------- panier : numéros d'ordre, total qui clignote, confettis au paiement ---------- */
  var bag = $('#bag-items');
  if (bag) {
    new MutationObserver(function () { $$('.item', bag).forEach(function (it, i) { it.style.setProperty('--i', i); }); }).observe(bag, { childList: true });
    $$('.item', bag).forEach(function (it, i) { it.style.setProperty('--i', i); });
    var tot = $('#s-tot'), last = tot && tot.textContent;
    if (tot) new MutationObserver(function () {
      if (tot.textContent === last) return; last = tot.textContent;
      tot.classList.remove('flash'); void tot.offsetWidth; tot.classList.add('flash');
    }).observe(tot, { childList: true, characterData: true, subtree: true });
    var form = $('#checkout');
    if (form) form.addEventListener('submit', function () {
      var b = $('.pay-btn').getBoundingClientRect(), cols = ['#8ee6a8', '#5dff8f', '#8ec5ff', '#ff7a72', '#e6fff0'];
      for (var i = 0; i < 70; i++) {
        var c = document.createElement('span'); c.className = 'confetti'; c.style.background = cols[i % cols.length];
        c.style.left = b.left + Math.random() * b.width + 'px'; c.style.top = b.top + 'px'; document.body.appendChild(c);
        c.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
          { transform: 'translate(' + (Math.random() - 0.5) * 500 + 'px,' + (-200 - Math.random() * 400) + 'px) rotate(' + Math.random() * 720 + 'deg)', opacity: 1, offset: 0.4 },
          { transform: 'translate(' + (Math.random() - 0.5) * 700 + 'px,' + (300 + Math.random() * 300) + 'px) rotate(' + Math.random() * 1080 + 'deg)', opacity: 0 }],
          { duration: 1800 + Math.random() * 900, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = (function (el) { return function () { el.remove(); }; })(c);
      }
    });
  }

  /* ---------- parallaxe des photos (Le projet) ---------- */
  var par = $$('.prj .portrait img, .s1 .ph img');
  if (par.length) {
    var go = function () {
      par.forEach(function (img) {
        var r = img.parentNode.getBoundingClientRect(), p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        img.style.setProperty('--par', (p * -60).toFixed(1) + 'px');
      });
    };
    addEventListener('scroll', function () { requestAnimationFrame(go); }, { passive: true }); go();
  }

  /* ---------- annotations du sac : ordre d'apparition ---------- */
  $$('.pp-mq .ann, .pp-mq .ann-line, .pp-mq .ann-plus').forEach(function (el, i) {
    el.style.setProperty('--a', Math.floor(i / 3));
    if (el.classList.contains('ann-line') && el.offsetHeight > el.offsetWidth) el.style.setProperty('--o', 'top');
  });
})();
