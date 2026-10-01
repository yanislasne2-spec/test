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

  about: [
    "Je photographie ce qui vit : un regard, une foule, une lumière qui tombe au bon endroit.",
    "Sport, portraits, concerts, paysages : je cherche l'instant où tout se joue, puis je le travaille en noir et blanc avec une touche de couleur."
  ],

  /* Chaque galerie = une « pellicule ».
     open: true  → visible même sans photo (affiche des cadres « à venir »)
     open: false → verrouillée tant que photos.js ne contient aucune photo pour elle.
     Dès que tu ajoutes des photos, la pellicule se déverrouille toute seule. */
  galleries: [
    {
      id: 'sport', roll: '01', title: 'Sport', kicker: 'Basket',
      accent: '#ff4d5a', open: true, placeholders: 9,
      intro: "Projecteurs, sueur et parquet. Le noir et blanc pour l'intensité, la couleur du maillot pour l'identité."
    },
    {
      id: 'portrait', roll: '02', title: 'Portrait', kicker: 'Visages',
      accent: '#ff9aa2', open: false,
      intro: "Des regards, des silhouettes, des histoires en une image."
    },
    {
      id: 'concert', roll: '03', title: 'Concerts', kicker: 'Scène',
      accent: '#e0304a', open: false,
      intro: "Les lumières, la foule, l'énergie de la scène."
    },
    {
      id: 'paysage', roll: '04', title: 'Paysages', kicker: 'Horizons',
      accent: '#f3c4c4', open: false,
      intro: "Prendre l'air. Lignes d'horizon et lumière naturelle."
    }
  ]
};
