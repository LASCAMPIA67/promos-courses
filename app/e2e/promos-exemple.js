// Un petit promos.json d'exemple, aux dates du jour, pour les scénarios réels et les captures.
// Mêmes champs que le vrai fichier (voir docs/format-promos.md).

/** Date à « décalage » jours d'aujourd'hui, au format du fichier : « 2026-10-27 ». */
function jour(decalage) {
  const date = new Date();
  date.setDate(date.getDate() + decalage);
  const deux = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

const LIDL = { source: "lidl", magasin: "lidl-lingolsheim", catalogue: "promos-de-la-semaine", categorie: null, ean: null };
const LECLERC = { source: "leclerc", magasin: "leclerc-geispolsheim", catalogue: "26G310G", page: null };

function offre(id, magasin, champs) {
  return {
    id,
    ...magasin,
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
    page: 3,
    ...champs,
  };
}

const OFFRES = [
  offre("lait-lidl", LIDL, {
    produit: "Lait demi-écrémé",
    marque: "MILSANI",
    description: "La bouteille de 1 L",
    prix: 0.89,
    ancien_prix: 1.05,
    prix_unitaire: 0.89,
    unite: "l",
    reduction: "-15 %",
  }),
  offre("lait-leclerc", LECLERC, {
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
  offre("chocolat", LECLERC, {
    produit: "CHOCOLAT AU LAIT",
    marque: "CÔTE D'OR",
    description: "200 g. Le kg : 10,75 €",
    prix: 2.15,
    ancien_prix: 2.69,
    prix_unitaire: 10.75,
    unite: "kg",
    reduction: "-20 %",
  }),
  offre("laitue", LIDL, { produit: "Laitue", description: "La pièce", prix: 0.79, prix_unitaire: 0.79, unite: "pièce" }),
  offre("beurre", LIDL, { produit: "Beurre doux", marque: "PÂTURAGES", prix: 1.99, date_debut: jour(-8), date_fin: jour(-1) }),
  offre("bananes", LIDL, {
    produit: "Bananes",
    description: "Le kg. Origine Côte d'Ivoire",
    prix: 1.29,
    ancien_prix: 1.69,
    prix_unitaire: 1.29,
    unite: "kg",
    reduction: "-23 % avec Lidl Plus",
    carte_fidelite: true,
    date_fin: jour(1),
  }),
  offre("pain", LECLERC, {
    produit: "PAIN DE MIE COMPLET",
    marque: "HARRYS",
    description: "500 g. Le kg : 4,70 €",
    prix: 2.35,
    prix_unitaire: 4.7,
    unite: "kg",
    reduction: "30 % en Ticket E.Leclerc",
    carte_fidelite: true,
  }),
  offre("cafe", LECLERC, {
    produit: "CAFÉ MOULU PUR ARABICA",
    marque: "CARTE NOIRE",
    description: "4 x 250 g (1 kg). Le kg : 9,99 €",
    prix: 9.99,
    ancien_prix: 13.32,
    prix_unitaire: 9.99,
    unite: "kg",
    reduction: "-25 %",
  }),
  offre("pates", LECLERC, {
    produit: "PÂTES SPAGHETTI",
    marque: "PANZANI",
    description: "500 g. Par 3 (1,5 kg) : 1,90 €",
    prix: 0.95,
    prix_unitaire: 1.9,
    unite: "kg",
    reduction: "2 + 1 offert",
    lot: { quantite: 3, prix: 1.9, prix_unitaire: 1.27 },
  }),
];

/** Le fichier d'exemple ; « miseAJour » : passage du robot, « etatLeclerc » : ok, partiel ou erreur. */
export function promosExemple({ miseAJour = new Date(), etatLeclerc = "ok" } = {}) {
  const source = (id, magasin, nom, etat) => ({
    id,
    magasin,
    nom,
    etat,
    nb_offres: OFFRES.filter((o) => o.source === id).length,
    remarque: null,
    catalogues: [],
  });
  return {
    format: 2,
    mise_a_jour: miseAJour.toISOString(),
    version_robot: "0.3.0",
    magasins: {
      "lidl-lingolsheim": { nom: "Lidl Lingolsheim", enseigne: "Lidl", ville: "Lingolsheim" },
      "leclerc-geispolsheim": { nom: "E.Leclerc Geispolsheim", enseigne: "E.Leclerc", ville: "Geispolsheim" },
    },
    sources: [
      source("lidl", "lidl-lingolsheim", "Prospectus Lidl France", "ok"),
      source("leclerc", "leclerc-geispolsheim", "Catalogues E.Leclerc Geispolsheim", etatLeclerc),
    ],
    offres: OFFRES,
  };
}

/** Sert ce fichier à la place de promos-test.json pour tous les onglets d'un navigateur de test. */
export async function servirPromos(contexte, options) {
  await contexte.route("**/promos-test.json", (requete) => requete.fulfill({ json: promosExemple(options) }));
}
