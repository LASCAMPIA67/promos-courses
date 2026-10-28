// Tous les produits, même sans promo : la base produits.json, écrite chaque semaine par le robot
// d'après Open Food Facts (voir src/robot_promos/produits.py et docs/format-promos.md). Pour chaque
// produit : son nom, sa marque, sa contenance, sa photo et, quand un catalogue Leclerc l'a donné, son
// prix habituel. Le fichier est gardé sur le téléphone : la recherche marche aussi sans réseau.

import { formaterPrix, joliNom, motsCles, regrouper } from "./promos.js";

export const URL_PRODUITS = "https://raw.githubusercontent.com/LASCAMPIA67/promos-courses/produits/produits.json";
export const FORMAT_PRODUITS = 1;

/** Ce qu'on sait du produit chez Leclerc : 2 Marque Repère, 1 vu chez Leclerc, 0 vendu en France. */
export const CHEZ_LECLERC = { marqueRepere: 2, sur: 1, enFrance: 0 };

const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/**
 * Vérifie produits.json et prépare la recherche. Les produits sont rangés par le robot : ceux qu'on
 * sait chez Leclerc d'abord, puis les plus courants. Pour rester léger sur le téléphone (plus de
 * 100 000 produits), chaque produit garde sa ligne du fichier et une seule « clé » de recherche :
 * ses mots-clés, puis ceux de sa marque (« ␣arome␣maggi␣|␣maggi␣ ») ; sa fiche n'est faite que pour
 * l'afficher. Lève une erreur si le fichier n'a pas le format attendu.
 */
export function indexerProduits(donnees) {
  const index = preparer(donnees);
  for (let rang = 0; rang < index.lignes.length; rang += 1) index.cles.push(cle(index, rang));
  return index;
}

/** Comme indexerProduits, par petits morceaux, sans bloquer l'appli pendant qu'on la touche. */
export async function indexerProduitsPeuAPeu(donnees, { parMorceau = 4000 } = {}) {
  const index = preparer(donnees);
  for (let rang = 0; rang < index.lignes.length; rang += 1) {
    index.cles.push(cle(index, rang));
    if (rang % parMorceau === parMorceau - 1) await new Promise((suite) => setTimeout(suite, 0));
  }
  return index;
}

function preparer(donnees) {
  if (donnees?.format !== FORMAT_PRODUITS || !Array.isArray(donnees.produits) || !Array.isArray(donnees.colonnes)) {
    throw new Error(`Format de produits.json inattendu (${donnees?.format}).`);
  }
  const place = Object.fromEntries(donnees.colonnes.map((nom, rang) => [nom, rang]));
  return { lignes: donnees.produits, place, photos: donnees.photos, cles: [], parCode: null };
}

function cle(index, rang) {
  const ligne = index.lignes[rang];
  return ` ${motsCles(ligne[index.place.nom]).join(" ")} | ${motsCles(ligne[index.place.marque]).join(" ")} `;
}

/** La fiche d'un produit, pour l'afficher : { ean, nom, marque, quantite, photo, leclerc, prixHabituel, prixVuLe }. */
export function produitDe(index, rang) {
  const ligne = index.lignes[rang];
  const { place } = index;
  return {
    ean: ligne[place.ean],
    nom: ligne[place.nom],
    marque: ligne[place.marque] ?? null,
    quantite: ligne[place.quantite] ?? null,
    photo: adressePhoto(index.photos, ligne[place.ean], ligne[place.photo]),
    leclerc: ligne[place.leclerc] ?? CHEZ_LECLERC.enFrance,
    prixHabituel: ligne[place.prix_habituel] ?? null,
    prixVuLe: ligne[place.prix_vu_le] ?? null,
  };
}

/**
 * L'adresse de la photo d'un produit : Open Food Facts range les photos par code-barres
 * (« 356/470/000/0229 ») ; le robot ne garde que la fin du nom du fichier (« front_fr.9 »).
 */
export function adressePhoto(base, ean, fichier) {
  if (!fichier || !/^https:\/\//.test(base ?? "") || !/^[a-z_]+\.\d+$/.test(fichier)) return null;
  const dossier = /^\d{13}$/.test(ean)
    ? `${ean.slice(0, 3)}/${ean.slice(3, 6)}/${ean.slice(6, 9)}/${ean.slice(9)}`
    : ean;
  return `${base}${dossier}/${fichier}.200.jpg`;
}

/** Au-delà, on ne classe que les premiers trouvés (les plus sûrs, puis les plus courants). */
const TROUVES_AU_PLUS = 1500;

/**
 * Les produits qui correspondent à ce qu'on écrit, comme pour les promos : chaque mot cherché est le
 * début d'un mot du produit ou de sa marque (« mag » trouve « Maggi »), ou un nom de famille complet
 * (« chips » trouve « Pringles »). `exclure` : les codes-barres déjà montrés en promo. Les plus
 * proches d'abord, puis ceux qu'on sait chez Leclerc, puis les plus courants. Renvoie [produit].
 */
export function rechercherProduits(index, texte, { exclure = new Set() } = {}) {
  const groupes = regrouper(motsCles(texte)).map(avecRaccourci);
  if (!index || groupes.length === 0) return [];
  const trouves = [];
  for (let rang = 0; rang < index.cles.length && trouves.length < TROUVES_AU_PLUS; rang += 1) {
    const cleProduit = index.cles[rang];
    let parFamille = false;
    let premier = null;
    const tousTrouves = groupes.every((groupe, i) => {
      let trouve = debut(cleProduit, groupe.mots) ? groupe.mots : null;
      // Un équivalent de sa famille, en mots entiers ; d'abord, d'un coup, ceux d'un seul mot.
      if (!trouve && (!groupe.unSeulMot || groupe.unSeulMot.test(cleProduit))) {
        trouve = groupe.equivalents.find((equivalent) => entiers(cleProduit, equivalent)) ?? null;
        if (trouve) parFamille = true;
      } else if (!trouve) {
        trouve = groupe.plusieursMots.find((equivalent) => entiers(cleProduit, equivalent)) ?? null;
        if (trouve) parFamille = true;
      }
      if (i === 0) premier = trouve;
      return trouve !== null;
    });
    if (!tousTrouves || exclure.has(index.lignes[rang][index.place.ean])) continue;
    // La place du premier mot cherché dans le nom du produit (pas dans sa marque).
    const motsProduit = cleProduit.slice(1, cleProduit.indexOf(" | ")).split(" ");
    const position = motsProduit.findIndex((mot) => mot.startsWith(premier[0]));
    trouves.push({
      rang,
      parFamille,
      position: position === -1 ? Number.MAX_SAFE_INTEGER : position,
      exact: entiers(cleProduit, premier),
    });
  }
  trouves.sort(
    (a, b) =>
      Number(a.parFamille) - Number(b.parFamille) ||
      a.position - b.position ||
      Number(b.exact) - Number(a.exact) ||
      a.rang - b.rang,
  );
  return trouves.map(({ rang }) => produitDe(index, rang));
}

const debut = (cle, mots) => mots.every((mot) => cle.includes(` ${mot}`));
const entiers = (cle, mots) => mots.every((mot) => cle.includes(` ${mot} `));

/**
 * Un groupe de mots cherchés, avec de quoi aller vite parmi plus de 100 000 produits : une seule
 * expression pour tous les équivalents d'un seul mot de sa famille (« pringles », « lay »…).
 */
function avecRaccourci(groupe) {
  const seuls = groupe.equivalents.filter((mots) => mots.length === 1).map(([mot]) => mot);
  const plusieursMots = groupe.equivalents.filter((mots) => mots.length > 1);
  const unSeulMot = seuls.length ? new RegExp(` (?:${seuls.map(echapper).join("|")}) `) : null;
  return { ...groupe, unSeulMot, plusieursMots };
}

const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Le produit d'un code-barres, ou null. */
export function produitDuCode(index, ean) {
  if (!index || !ean) return null;
  index.parCode ??= new Map(index.lignes.map((ligne, rang) => [ligne[index.place.ean], rang]));
  const rang = index.parCode.get(ean);
  return rang === undefined ? null : produitDe(index, rang);
}

/** « Nutella · Ferrero · 750 g » → le nom du produit à écrire dans la liste, sans la marque. */
export function nomDuProduit(produit) {
  return joliNom(produit.nom).slice(0, 100).trim();
}

/** Ce qu'on dit du prix d'un produit sans promo : « Prix habituel 2,15 € (vu le 12 oct.) », ou null. */
export function phrasePrix(produit) {
  if (produit.prixHabituel == null) return null;
  const quand = produit.prixVuLe ? ` (vu le ${jourCourt(produit.prixVuLe)})` : "";
  return `Prix habituel ${formaterPrix(produit.prixHabituel)}${quand}`;
}

/**
 * L'article à ajouter à la liste depuis un produit : son nom, son prix habituel s'il est connu
 * (« Prix habituel 2,15 € »), et son code-barres, pour sa photo et sa promo quand il y en aura une.
 */
export function articleDepuisProduit(produit) {
  const note = produit.prixHabituel == null ? null : `Prix habituel ${formaterPrix(produit.prixHabituel)}`;
  return { nom: nomDuProduit(produit), ...(note ? { note } : {}), produit: produit.ean };
}

function jourCourt(iso) {
  const [annee, mois, jour] = iso.split("-").map(Number);
  const date = new Date(annee, mois - 1, jour);
  const texte = JOUR_COURT.format(date);
  return date.getDate() === 1 ? texte.replace(/\b1\b/, "1er") : texte;
}
