/* ============================================================
   CONFIG DU SITE — c'est ici que tu personnalises tout.
   Les photos elles-mêmes sont listées dans photos.js
   (généré automatiquement par generer-galeries.py).
   ============================================================ */
window.SITE = {
  name: 'Yanis Lasne',
  role: 'Photographe',
  location: '',            // ex. 'Nantes, France'
  email: 'ylasne.pro@gmail.com',
  instagram: 'yanis_lsn',  // sans le @
  aboutPhoto: '',          // ex. 'photos/moi.jpg' (sinon un monogramme s'affiche)
  contactPhoto: 'photos/moi.jpg', // photo de toi dans la section « On shoote ensemble ? » (vide = pas de photo)

  // Photos du diaporama plein écran de l'accueil (dans l'ordre, 8 max). Vide = les premières photos.
  hero: [
    'photos/sport/sport-01.jpg',
    'photos/portrait/portrait-02.jpg',
    'photos/paysage/paysage-02.jpg',
    'photos/sport/sport-03.jpg',
    'photos/paysage/paysage-01.jpg',
    'photos/sport/sport-04.jpg',
    'photos/portrait/portrait-04.jpg',
    'photos/concert/concert-02.jpg'
  ],

  // « La sélection » de l'accueil : les photos fortes, dans l'ordre. Vide = toutes les photos.
  selection: [
    'photos/sport/sport-01.jpg',
    'photos/sport/sport-03.jpg',
    'photos/portrait/portrait-02.jpg',
    'photos/sport/sport-02.jpg',
    'photos/concert/concert-01.jpg',
    'photos/sport/sport-07.jpg',
    'photos/portrait/portrait-07.jpg',
    'photos/sport/sport-06.jpg',
    'photos/paysage/paysage-06.jpg',
    'photos/sport/sport-04.jpg'
  ],

  about: [
    "Je photographie ce qui vit : un regard, une foule, une lumière qui tombe au bon endroit.",
    "Sport, portraits, concerts, paysages : je cherche l'instant où tout se joue, et la lumière qui le raconte."
  ],

  /* Chaque galerie = une « pellicule ».
     open: true  → visible même sans photo (affiche des cadres « à venir »)
     open: false → verrouillée tant que photos.js ne contient aucune photo pour elle.
     Dès que tu ajoutes des photos, la pellicule se déverrouille toute seule. */
  galleries: [
    {
      id: 'sport', roll: '01', title: 'Sport', kicker: 'Basket',
      accent: '#ff4d5a', open: true, placeholders: 9,
      intro: "Parquet, projecteurs et concentration. Le jeu vu au plus près des joueurs."
    },
    {
      id: 'portrait', roll: '02', title: 'Portrait', kicker: 'Visages',
      accent: '#ff9aa2', open: false,
      intro: "Néons de station-service, allées de parc : des visages et des silhouettes, chacun dans son décor."
    },
    {
      id: 'concert', roll: '03', title: 'Concerts', kicker: 'Scène',
      accent: '#e0304a', open: false,
      intro: "Projecteurs, fumée et lumières de scène. L'énergie du live, au plus près des artistes."
    },
    {
      id: 'paysage', roll: '04', title: 'Paysages', kicker: 'Horizons',
      accent: '#f3c4c4', open: false,
      intro: "Ruelles blanchies à la chaux, mer turquoise et couchers de soleil."
    }
  ]
};
