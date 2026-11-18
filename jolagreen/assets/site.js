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
  /* lien « retour » */
  document.querySelectorAll('[data-back]').forEach(function (a) {
    a.addEventListener('click', function (e) { if (history.length > 1) { e.preventDefault(); history.back(); } });
  });
})();
