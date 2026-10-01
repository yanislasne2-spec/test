/* ============================================================
   CONFIG DU SITE — c'est ici que tu personnalises tout.
   Les photos elles-mêmes sont listées dans photos.js
   (généré automatiquement par generer-galeries.py).
   ============================================================ */
window.SITE = {
  name: 'Yanis Lasne',
  role: 'Photographe',
  location: '',            // ex. 'Paris, France'
  email: '',               // ex. 'contact@tondomaine.fr' (laisse vide pour cacher le bouton)
  instagram: '',           // ex. 'yanislasne' (sans le @)
  aboutPhoto: '',          // ex. 'photos/moi.jpg' (sinon un monogramme s'affiche)

  about: [
    "Je photographie ce qui bouge : le parquet qui grince, la sueur sous les projecteurs, la seconde suspendue avant le buzzer.",
    "Le basket est mon terrain de jeu, mais le viseur ne s'arrête pas là : portraits, concerts et paysages arrivent bientôt dans de nouvelles pellicules."
  ],

  /* Chaque galerie = une « pellicule ».
     open: true  → visible même sans photo (affiche des cadres « à venir »)
     open: false → verrouillée tant que photos.js ne contient aucune photo pour elle.
     Dès que tu ajoutes des photos, la pellicule se déverrouille toute seule. */
  galleries: [
    {
      id: 'sport', roll: '01', title: 'Sport', kicker: 'Basket',
      accent: '#ff5a1f', open: true, placeholders: 9,
      intro: "Crissement de semelles, contre-attaque, dunk. Le jeu à 1/1000e de seconde."
    },
    {
      id: 'portrait', roll: '02', title: 'Portrait', kicker: 'Visages',
      accent: '#f2b49b', open: false,
      intro: "Des regards, des silhouettes, des histoires en une image."
    },
    {
      id: 'concert', roll: '03', title: 'Concerts', kicker: 'Scène',
      accent: '#b06bff', open: false,
      intro: "Les lumières, la foule, l'énergie de la scène."
    },
    {
      id: 'paysage', roll: '04', title: 'Paysages', kicker: 'Horizons',
      accent: '#5fd3a8', open: false,
      intro: "Prendre l'air. Lignes d'horizon et lumière naturelle."
    }
  ]
};
