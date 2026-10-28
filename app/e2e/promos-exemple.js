// Un petit promos.json d'exemple, aux dates du jour, pour les scénarios réels et les captures.
// Mêmes champs que le vrai fichier (voir docs/format-promos.md).

import { logoExemple, photoProduitExemple } from "./fichiers-exemple.js";

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
  "jambon.jpg": [232, 150, 160],
};

/** Les logos d'exemple : nom → couleur du cartouche. « absent.png » n'existe pas. */
const LOGOS = "https://exemple.test/logos/";
const COULEURS_LOGOS = {
  "candia.png": [30, 90, 200],
  "lactel.png": [20, 70, 160],
  "panzani.png": [0, 110, 60],
  "harrys.png": [200, 30, 40],
  "marque-repere.png": [226, 30, 36],
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
    logo_catalogue: null,
    logo: null,
    logo_marque: null,
    page: 3,
    historique: null,
    ...champs,
  };
}

const OFFRES = [
  offre("lait", {
    photo: `${PHOTOS}lait.jpg`,
    logo: `${LOGOS}candia.png`,
    produit: "Lait demi-écrémé",
    marque: "CANDIA",
    ean: "3533630000001",
    description: "La bouteille de 1 L",
    prix: 0.89,
    ancien_prix: 1.05,
    prix_unitaire: 0.89,
    unite: "l",
    reduction: "-15 %",
    // Déjà vu en promo, plus cher : le meilleur prix vu.
    historique: { verdict: "plus_bas", depuis: jour(-40), promos: 2, meilleur_prix: 0.95, meilleur_le: jour(-12) },
  }),
  offre("lait-leclerc", {
    photo: `${PHOTOS}lait-uht.jpg`,
    logo: `${LOGOS}lactel.png`,
    produit: "LAIT DEMI-ÉCRÉMÉ UHT",
    marque: "LACTEL",
    description: "6 x 1 L. Par 2 (12 L) : 9,18 € au lieu de 12,24 €",
    prix: 6.12,
    prix_unitaire: 1.02,
    unite: "l",
    reduction: "-50 % sur le 2e",
    lot: { quantite: 2, prix: 9.18, prix_unitaire: 0.77 },
    historique: { verdict: "plus_cher", depuis: jour(-60), promos: 3, meilleur_prix: 4.29, meilleur_le: jour(-20) },
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
    logo: `${LOGOS}harrys.png`,
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
    logo: `${LOGOS}panzani.png`,
    produit: "PÂTES SPAGHETTI",
    marque: "PANZANI",
    description: "500 g. Par 3 (1,5 kg) : 1,90 €",
    prix: 0.95,
    prix_unitaire: 1.9,
    unite: "kg",
    reduction: "2 + 1 offert",
    lot: { quantite: 3, prix: 1.9, prix_unitaire: 1.27 },
  }),
  // Un produit Marque Repère (une gamme de la marque) : le logo Marque Repère.
  offre("jambon", {
    photo: `${PHOTOS}jambon.jpg`,
    logo: `${LOGOS}marque-repere.png`,
    logo_marque: "Marque Repère",
    produit: "JAMBON CUIT SUPÉRIEUR",
    marque: "TRADILÈGE",
    ean: "3661112000000",
    description: "4 tranches (160 g). Le kg : 14,69 €",
    prix: 2.35,
    ancien_prix: 2.95,
    prix_unitaire: 14.69,
    unite: "kg",
    reduction: "-20 %",
  }),
  // Une même promo « au choix », que le catalogue donne en deux offres : l'appli n'en montre qu'une.
  ...["SHAMPOOING", "SHAMPOOING PURIFIANT"].map((produit, rang) =>
    offre(`shampooing-${rang + 1}`, {
      photo: `${PHOTOS}shampooing.jpg`,
      logo: `${LOGOS}absent.png`,
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
 * Tous les produits (produits.json, comme l'écrit le robot d'après Open Food Facts et ses bases
 * sœurs) : un produit aussi en promo (le lait Candia, montré une seule fois, avec sa promo), des
 * produits sans promo, avec ou sans photo, avec ou sans prix habituel, et un dentifrice d'Open Beauty
 * Facts. `en plus` : d'autres produits, au même format.
 */
export function produitsExemple({ enPlus = [] } = {}) {
  return {
    format: 1,
    mise_a_jour: new Date().toISOString(),
    licence: "Open Food Facts (exemple)",
    sources: [{ nom: "Open Food Facts", etat: "ok", produits: 7 }],
    photos: { off: "https://exemple.test/off/", obf: "https://exemple.test/obf/" },
    colonnes: ["ean", "nom", "marque", "quantite", "photo", "leclerc", "prix_habituel", "prix_vu_le"],
    produits: [
      ["3533630000001", "Lait demi-écrémé", "Candia", "1 l", "front_fr.4", 1, 1.05, jour(-20)],
      ["3017620422003", "Nutella", "Ferrero", "750 g", "front_fr.12", 1, 6.25, jour(-20)],
      ["7613035000000", "Arôme Maggi", "Maggi", "250 ml", "front_fr.3", 0, null, null],
      ["7613035000017", "Bouillon cube volaille", "Maggi", null, null, 0, null, null],
      ["3564700000229", "Brocolis surgelés", "Notre Jardin", "1 kg", "front_fr.9", 2, null, null],
      ["3428270000002", "Lait entier bio", "Lactel", "1 l", "front_fr.5", 1, 1.29, jour(-20)],
      ["8714789000007", "Dentifrice blancheur", "Signal", "75 ml", "obf:front_fr.2", 0, null, null],
      ...enPlus,
    ],
  };
}

/**
 * Les vignettes des produits déjà vus en promo (vignettes.json, comme l'écrit le robot) : la photo du
 * catalogue Leclerc du lait entier bio, et les logos de Maggi et de Marque Repère.
 */
export const VIGNETTES = "https://exemple.test/vignettes/";
export const VIGNETTE_LAIT_ENTIER = `${"1".repeat(32)}.jpg`;
export function vignettesExemple() {
  return {
    format: 1,
    adresse: VIGNETTES,
    photos: { 3428270000002: VIGNETTE_LAIT_ENTIER },
    logos: { MAGGI: `logos/${"2".repeat(32)}.png` },
    marque_repere: `logos/${"3".repeat(32)}.png`,
  };
}

/** Sert tous les produits, leurs photos (comme images.openfoodfacts.org…) et les vignettes à un navigateur de test. */
export async function servirProduits(contexte, options) {
  await contexte.route("**/produits-test.json", (requete) => requete.fulfill({ json: produitsExemple(options) }));
  await contexte.route("**/vignettes-test.json", (requete) => requete.fulfill({ json: vignettesExemple() }));
  for (const [site, couleur] of [
    ["off", [214, 120, 40]],
    ["obf", [40, 120, 214]],
  ]) {
    await contexte.route(`https://exemple.test/${site}/**`, (requete) =>
      requete.fulfill({
        contentType: "image/png",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: photoProduitExemple(couleur),
      }),
    );
  }
  await contexte.route(`${VIGNETTES}**`, (requete) => {
    const logo = new URL(requete.request().url()).pathname.includes("/logos/");
    return requete.fulfill({
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: logo ? logoExemple([200, 30, 40]) : photoProduitExemple([46, 158, 91]),
    });
  });
}

export async function servirPromos(contexte, options) {
  await contexte.route("**/promos-test.json", (requete) => requete.fulfill({ json: promosExemple(options) }));
  await contexte.route(`${LOGOS}**`, (requete) => {
    const couleur = COULEURS_LOGOS[new URL(requete.request().url()).pathname.split("/").at(-1)];
    if (!couleur) return requete.fulfill({ status: 404, body: "introuvable" });
    return requete.fulfill({
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: logoExemple(couleur),
    });
  });
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
