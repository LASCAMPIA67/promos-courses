// Tous les produits, même sans promo : la base produits.json, écrite chaque semaine par le robot
// d'après Open Food Facts et ses bases sœurs (voir src/robot_promos/produits.py et
// docs/format-promos.md). Pour chaque produit : son nom, sa marque, sa contenance, sa photo et, quand
// un catalogue Leclerc l'a donné, son prix habituel. S'y ajoutent les photos et les logos des
// produits déjà vus dans un catalogue Leclerc (vignettes.json, voir src/robot_promos/photos.py). Les
// fichiers sont gardés sur le téléphone : la recherche marche aussi sans réseau.

import { comparerProximite, formaterPrix, joliNom, motsCles, regrouperAvecApproches } from "./promos.js";
import { rangerParLongueur } from "./ressemblance.js";

export const URL_PRODUITS = "https://raw.githubusercontent.com/LASCAMPIA67/promos-courses/produits/produits.json";
export const FORMAT_PRODUITS = 1;
export const URL_VIGNETTES = "https://raw.githubusercontent.com/LASCAMPIA67/promos-courses/photos/vignettes.json";
export const FORMAT_VIGNETTES = 1;

/** Ce qu'on sait du produit chez Leclerc : 2 Marque Repère, 1 vu chez Leclerc, 0 vendu en France. */
export const CHEZ_LECLERC = { marqueRepere: 2, sur: 1, enFrance: 0 };

const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/**
 * Vérifie produits.json et prépare la recherche. Les produits sont rangés par le robot : ceux qu'on
 * sait chez Leclerc d'abord, puis les plus courants. Pour rester léger sur le téléphone (plus de
 * 100 000 produits), chaque produit garde sa ligne du fichier et une seule « clé » de recherche :
 * ses mots-clés, puis ceux de sa marque (« ␣arome␣maggi␣|␣maggi␣ ») ; sa fiche n'est faite que pour
 * l'afficher. On garde aussi tous les mots connus, pour les mots mal écrits (voir ressemblance.js).
 * Lève une erreur si le fichier n'a pas le format attendu.
 */
export function indexerProduits(donnees) {
  const index = preparer(donnees);
  for (let rang = 0; rang < index.lignes.length; rang += 1) index.cles.push(cle(index, rang));
  return terminer(index);
}

/** Comme indexerProduits, par petits morceaux, sans bloquer l'appli pendant qu'on la touche. */
export async function indexerProduitsPeuAPeu(donnees, { parMorceau = 4000 } = {}) {
  const index = preparer(donnees);
  for (let rang = 0; rang < index.lignes.length; rang += 1) {
    index.cles.push(cle(index, rang));
    if (rang % parMorceau === parMorceau - 1) await new Promise((suite) => setTimeout(suite, 0));
  }
  return terminer(index);
}

function preparer(donnees) {
  if (donnees?.format !== FORMAT_PRODUITS || !Array.isArray(donnees.produits) || !Array.isArray(donnees.colonnes)) {
    throw new Error(`Format de produits.json inattendu (${donnees?.format}).`);
  }
  const place = Object.fromEntries(donnees.colonnes.map((nom, rang) => [nom, rang]));
  // L'adresse des photos de chaque base ; une seule adresse : celle d'Open Food Facts (premiers fichiers).
  const photos = typeof donnees.photos === "string" ? { off: donnees.photos } : (donnees.photos ?? {});
  return { lignes: donnees.produits, place, photos, cles: [], parCode: null, mots: new Map(), vocabulaire: null };
}

function cle(index, rang) {
  const ligne = index.lignes[rang];
  const motsNom = motsCles(ligne[index.place.nom]);
  const motsMarque = motsCles(ligne[index.place.marque]);
  // Chaque mot connu, et dans combien de produits (les plus courants d'abord pour un mot mal écrit).
  for (const mot of new Set([...motsNom, ...motsMarque])) index.mots.set(mot, (index.mots.get(mot) ?? 0) + 1);
  return ` ${motsNom.join(" ")} | ${motsMarque.join(" ")} `;
}

function terminer(index) {
  index.vocabulaire = rangerParLongueur(index.mots.keys());
  return index;
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
 * L'adresse de la photo d'un produit : chaque base range ses photos par code-barres
 * (« 356/470/000/0229 ») ; le robot ne garde que la fin du nom du fichier (« front_fr.9 »), précédée
 * du code de la base quand ce n'est pas Open Food Facts (« obf:front_fr.3 »). `photos` : l'adresse
 * des photos de chaque base ({ off, obf, opf, opff }).
 */
export function adressePhoto(photos, ean, fichier) {
  const trouve = /^(?:([a-z]+):)?([a-z_]+\.\d+)$/.exec(fichier ?? "");
  if (!trouve) return null;
  const base = photos?.[trouve[1] ?? "off"];
  if (!/^https:\/\//.test(base ?? "")) return null;
  const dossier = /^\d{13}$/.test(ean)
    ? `${ean.slice(0, 3)}/${ean.slice(3, 6)}/${ean.slice(6, 9)}/${ean.slice(9)}`
    : ean;
  return `${base}${dossier}/${trouve[2]}.200.jpg`;
}

/** Au-delà, on ne classe que les premiers trouvés (les plus sûrs, puis les plus courants). */
const TROUVES_AU_PLUS = 1500;

/**
 * Les produits qui correspondent à ce qu'on écrit, comme pour les promos : chaque mot cherché est le
 * début d'un mot du produit ou de sa marque (« mag » trouve « Maggi »), ou un nom de famille complet
 * (« chips » trouve « Pringles »), ou un mot connu qui ressemble à un mot mal écrit (`approches`,
 * voir ressemblance.js). `exclure` : des codes-barres à laisser de côté. Les plus proches d'abord,
 * puis ceux qu'on sait chez Leclerc, puis les plus courants. Renvoie [{ produit, proximite }].
 */
export function rechercherProduits(index, texte, { exclure = new Set(), approches } = {}) {
  const groupes = regrouperAvecApproches(motsCles(texte), approches).map(avecRaccourci);
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
      proximite: {
        parFamille,
        position: position === -1 ? Number.MAX_SAFE_INTEGER : position,
        exact: entiers(cleProduit, premier),
      },
    });
  }
  trouves.sort((a, b) => comparerProximite(a.proximite, b.proximite) || a.rang - b.rang);
  return trouves.map(({ rang, proximite }) => ({ produit: produitDe(index, rang), proximite }));
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

/**
 * Vérifie vignettes.json : les photos des produits déjà vus dans un catalogue Leclerc (par
 * code-barres) et les logos de leurs marques. Seules les adresses sûres sont gardées. Renvoie
 * { photos: Map(ean → adresse), logos: Map(marque → adresse), marqueRepere }, ou lève une erreur.
 */
export function indexerVignettes(donnees) {
  if (donnees?.format !== FORMAT_VIGNETTES || !/^https:\/\//.test(donnees.adresse ?? "")) {
    throw new Error(`Format de vignettes.json inattendu (${donnees?.format}).`);
  }
  const adresse = (fichier, motif) => (motif.test(fichier ?? "") ? `${donnees.adresse}${fichier}` : null);
  const PHOTO = /^[0-9a-f]{16,64}\.jpg$/;
  const LOGO = /^logos\/[0-9a-f]{16,64}\.png$/;
  const garder = (objet, motif) =>
    new Map(
      Object.entries(objet ?? {})
        .map(([cle, fichier]) => [cle, adresse(fichier, motif)])
        .filter(([, valeur]) => valeur),
    );
  return {
    photos: garder(donnees.photos, PHOTO),
    logos: garder(donnees.logos, LOGO),
    marqueRepere: adresse(donnees.marque_repere, LOGO),
  };
}

/** La marque, écrite comme le robot la range (« Côte d'Or » → « COTE D OR »). */
export function cleMarque(marque) {
  return String(marque ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toUpperCase();
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
