// Un petit promos.json d'exemple, aux dates du jour, pour les scénarios réels et les captures.
// Mêmes champs que le vrai fichier (voir docs/format-promos.md).

import { photoProduitExemple } from "./fichiers-exemple.js";

/** Les photos d'exemple : nom → couleur de l'emballage dessiné. « absente.jpg » n'existe pas. */
const PHOTOS = "https://exemple.test/photos/";
const COULEURS = {
  "lait.jpg": [47, 125, 225],
  "lait-uht.jpg": [31, 95, 191],
  "chocolat.jpg": [110, 60, 30],
  "pringles.jpg": [200, 40, 40],
  "pain.jpg": [196, 140, 70],
  "cafe.jpg": [45, 45, 45],
  "pates.jpg": [235, 190, 40],
  "shampooing.jpg": [46, 158, 91],
};

/** Date à « décalage » jours d'aujourd'hui, au format du fichier : « 2026-10-27 ». */
function jour(decalage) {
  const date = new Date();
  date.setDate(date.getDate() + decalage);
  const deux = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

function offre(id, champs) {
  return {
    id,
    source: "leclerc",
    magasin: "leclerc-geispolsheim",
    catalogue: "26G310G",
    marque: null,
    description: null,
    categorie: null,
    ean: null,
    ancien_prix: null,
    prix_unitaire: null,
    unite: null,
    reduction: null,
    lot: null,
    carte_fidelite: false,
    date_debut: jour(-2),
    date_fin: jour(4),
    lien: `https://exemple.test/catalogue/${id}`,
    image: null,
    photo: null,
    page: 3,
    ...champs,
  };
}

const OFFRES = [
  offre("lait", {
    photo: `${PHOTOS}lait.jpg`,
    produit: "Lait demi-écrémé",
    marque: "CANDIA",
    description: "La bouteille de 1 L",
    prix: 0.89,
    ancien_prix: 1.05,
    prix_unitaire: 0.89,
    unite: "l",
    reduction: "-15 %",
  }),
  offre("lait-leclerc", {
    photo: `${PHOTOS}lait-uht.jpg`,
    produit: "LAIT DEMI-ÉCRÉMÉ UHT",
    marque: "LACTEL",
    description: "6 x 1 L. Par 2 (12 L) : 9,18 € au lieu de 12,24 €",
    prix: 6.12,
    prix_unitaire: 1.02,
    unite: "l",
    reduction: "-50 % sur le 2e",
    lot: { quantite: 2, prix: 9.18, prix_unitaire: 0.77 },
    date_debut: jour(2),
    date_fin: jour(9),
  }),
  offre("chocolat", {
    photo: `${PHOTOS}chocolat.jpg`,
    produit: "CHOCOLAT AU LAIT",
    marque: "CÔTE D'OR",
    description: "200 g. Le kg : 10,75 €",
    prix: 2.15,
    ancien_prix: 2.69,
    prix_unitaire: 10.75,
    unite: "kg",
    reduction: "-20 %",
  }),
  offre("laitue", {
    produit: "Laitue",
    description: "La pièce",
    prix: 0.79,
    prix_unitaire: 0.79,
    unite: "pièce",
  }),
  // Pas de « chips » dans le nom : trouvée par la famille « chips ».
  offre("pringles", {
    photo: `${PHOTOS}pringles.jpg`,
    produit: "PRINGLES",
    description: "Le paquet de 165 g",
    prix: 1.99,
    ancien_prix: 2.79,
    reduction: "-28 %",
  }),
  offre("beurre", {
    produit: "Beurre doux",
    marque: "PÂTURAGES",
    prix: 1.99,
    date_debut: jour(-8),
    date_fin: jour(-1),
  }),
  offre("bananes", {
    photo: `${PHOTOS}absente.jpg`,
    produit: "Bananes",
    description: "Le kg. Origine Côte d'Ivoire",
    prix: 1.29,
    ancien_prix: 1.69,
    prix_unitaire: 1.29,
    unite: "kg",
    reduction: "-23 %",
    carte_fidelite: true,
    date_fin: jour(1),
  }),
  offre("pain", {
    photo: `${PHOTOS}pain.jpg`,
    produit: "PAIN DE MIE COMPLET",
    marque: "HARRYS",
    description: "500 g. Le kg : 4,70 €",
    prix: 1.65,
    ancien_prix: 2.35,
    prix_unitaire: 3.3,
    unite: "kg",
    reduction: "30 % en Ticket E.Leclerc",
    carte_fidelite: true,
  }),
  offre("cafe", {
    photo: `${PHOTOS}cafe.jpg`,
    produit: "CAFÉ MOULU PUR ARABICA",
    marque: "CARTE NOIRE",
    description: "4 x 250 g (1 kg). Le kg : 9,99 €",
    prix: 9.99,
    ancien_prix: 13.32,
    prix_unitaire: 9.99,
    unite: "kg",
    reduction: "-25 %",
  }),
  offre("pates", {
    photo: `${PHOTOS}pates.jpg`,
    produit: "PÂTES SPAGHETTI",
    marque: "PANZANI",
    description: "500 g. Par 3 (1,5 kg) : 1,90 €",
    prix: 0.95,
    prix_unitaire: 1.9,
    unite: "kg",
    reduction: "2 + 1 offert",
    lot: { quantite: 3, prix: 1.9, prix_unitaire: 1.27 },
  }),
  // Une même promo « au choix », que le catalogue donne en deux offres : l'appli n'en montre qu'une.
  ...["SHAMPOOING", "SHAMPOOING PURIFIANT"].map((produit, rang) =>
    offre(`shampooing-${rang + 1}`, {
      photo: `${PHOTOS}shampooing.jpg`,
      produit,
      marque: "LE PETIT MARSEILLAIS",
      description: "Au choix : Douceur & Éclat, Nutrition, Purifiant. 2 x 300 ml (600 ml)",
      prix: 2.24,
      ancien_prix: 3.73,
      reduction: "-40 %",
    }),
  ),
];

/**
 * Le fichier d'exemple ; « miseAJour » : passage du robot, « etatLeclerc » : ok, partiel ou erreur,
 * « multiplier » : chaque promo répétée ce nombre de fois (pour avoir beaucoup de promos).
 */
export function promosExemple({ miseAJour = new Date(), etatLeclerc = "ok", multiplier = 1 } = {}) {
  const offres = Array.from({ length: multiplier }, (_, n) =>
    // Chaque copie a un prix un peu différent : ce sont de vraies promos distinctes, pas des variantes.
    OFFRES.map((o) => (n === 0 ? o : { ...o, id: `${o.id}-${n + 1}`, prix: o.prix + n / 100 })),
  ).flat();
  const source = (id, magasin, nom, etat) => ({
    id,
    magasin,
    nom,
    etat,
    nb_offres: offres.filter((o) => o.source === id).length,
    remarque: null,
    catalogues: [],
  });
  return {
    format: 2,
    mise_a_jour: miseAJour.toISOString(),
    version_robot: "0.3.0",
    magasins: {
      "leclerc-geispolsheim": { nom: "E.Leclerc Geispolsheim", enseigne: "E.Leclerc", ville: "Geispolsheim" },
    },
    sources: [source("leclerc", "leclerc-geispolsheim", "Catalogues E.Leclerc Geispolsheim", etatLeclerc)],
    offres,
  };
}

/**
 * Sert ce fichier à la place de promos-test.json pour tous les onglets d'un navigateur de test, avec
 * ses photos (comme raw.githubusercontent.com : lisibles depuis l'appli, « absente.jpg » introuvable).
 */
export async function servirPromos(contexte, options) {
  await contexte.route("**/promos-test.json", (requete) => requete.fulfill({ json: promosExemple(options) }));
  await contexte.route(`${PHOTOS}**`, (requete) => {
    const couleur = COULEURS[new URL(requete.request().url()).pathname.split("/").at(-1)];
    if (!couleur) return requete.fulfill({ status: 404, body: "introuvable" });
    return requete.fulfill({
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: photoProduitExemple(couleur),
    });
  });
}
