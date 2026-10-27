// Les promos de nos magasins (fichier promos.json, écrit chaque matin par le robot) et leur
// comparaison avec la liste de courses. Sans Firebase ni réseau : facile à tester.

import { FAMILLES } from "./familles.js";

/** Le fichier promos.json du dépôt, tel que le robot l'enregistre chaque matin. */
export const URL_PROMOS = "https://raw.githubusercontent.com/LASCAMPIA67/promos-courses/main/promos.json";

/** Version du format de promos.json que l'appli sait lire (voir docs/format-promos.md). */
export const FORMAT = 2;

/** Notre magasin principal : à pertinence égale, ses promos passent avant les autres. */
export const MAGASIN_PRINCIPAL = "leclerc";

/** Le robot passe chaque matin : au-delà de ce délai, il a manqué au moins un passage. */
export const HEURES_AVANT_ALERTE = 36;

// Petits mots et unités qui ne disent rien du produit.
const MOTS_VIDES = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "d",
  "de",
  "des",
  "du",
  "en",
  "et",
  "l",
  "la",
  "le",
  "les",
  "ou",
  "par",
  "pour",
  "sans",
  "sur",
  "un",
  "une",
  "cl",
  "kg",
  "ml",
]);

// Mots que seul l'accent distingue d'un autre : « pâté » n'est pas « pâte », « glacé » pas « glace ».
const FAUX_AMIS = [
  [/\bpâtés?(?!\p{L})/gu, "patee"],
  [/\bglacée?s?(?!\p{L})/gu, "glacee"],
];

/**
 * Mots-clés d'un texte, pour comparer un article de la liste aux produits en promo :
 * « Œufs frais de la ferme » → ["oeuf", "frai", "ferme"].
 * Minuscules, sans accents, sans petits mots ni nombres, et au singulier (s ou x final retiré).
 */
export function motsCles(texte) {
  let minuscules = String(texte ?? "").toLowerCase();
  for (const [motif, remplacement] of FAUX_AMIS) minuscules = minuscules.replace(motif, remplacement);
  return minuscules
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length > 1 && !MOTS_VIDES.has(mot) && !/^\d/.test(mot))
    .map((mot) => (mot.length > 3 && /[sx]$/.test(mot) ? mot.slice(0, -1) : mot));
}

/**
 * Vérifie le contenu de promos.json et prépare chaque offre pour la recherche.
 * Lève une erreur si le fichier n'a pas le format attendu.
 */
export function indexerPromos(donnees) {
  if (donnees?.format !== FORMAT || !Array.isArray(donnees.offres)) {
    throw new Error(`Format de promos.json inattendu (${donnees?.format}) : l'appli lit le format ${FORMAT}.`);
  }
  return donnees.offres.map((offre) => ({
    offre,
    motsProduit: motsCles(offre.produit),
    motsMarque: new Set(motsCles(offre.marque)),
  }));
}

// Les familles de produits, réduites à leurs mots-clés : [{ cles: [[mots]], termes: [[mots]] }].
let famillesPretes;
function familles() {
  famillesPretes ??= FAMILLES.map(({ cles, termes }) => ({
    cles: cles.map(motsCles).filter((mots) => mots.length),
    termes: termes.map(motsCles).filter((mots) => mots.length),
  }));
  return famillesPretes;
}

/**
 * Regroupe les mots cherchés : un mot seul, ou le nom d'une famille (« chips », « papier toilette »)
 * avec ses équivalents (« pringles », « lay »…). Renvoie [{ mots, equivalents: [[mots]] }], dans
 * l'ordre de l'article.
 */
export function regrouper(motsCherches) {
  const restants = [...new Set(motsCherches)];
  const groupes = [];
  // Les noms de famille les plus longs d'abord : « papier toilette » avant « papier ».
  const noms = familles()
    .flatMap((famille) => famille.cles.map((cle) => ({ cle, famille })))
    .sort((a, b) => b.cle.length - a.cle.length);
  for (const { cle, famille } of noms) {
    if (!cle.every((mot) => restants.includes(mot))) continue;
    const place = restants.indexOf(cle[0]);
    for (const mot of cle) restants[restants.indexOf(mot)] = null;
    const equivalents = [...famille.cles, ...famille.termes].filter((mots) => mots.join(" ") !== cle.join(" "));
    groupes.push({ mots: cle, equivalents, place });
  }
  restants.forEach((mot, place) => {
    if (mot) groupes.push({ mots: [mot], equivalents: [], place });
  });
  return groupes.sort((a, b) => a.place - b.place).map(({ mots, equivalents }) => ({ mots, equivalents }));
}

/**
 * Les promos qui correspondent à un article de la liste : tous les mots de l'article doivent se
 * retrouver dans le nom du produit ou sa marque, ou un équivalent de sa famille (« chips » trouve
 * « Pringles »). Les promos terminées sont écartées.
 * Les plus proches d'abord : celles qui contiennent les mots de l'article avant celles trouvées par
 * leur famille, celles dont le nom commence par l'article (« Lait demi-écrémé » avant « Chocolat au
 * lait »), celles en cours avant celles à venir, puis les noms les plus courts.
 * Renvoie [{ offre, aVenir }].
 */
export function chercherPromos(index, nom, aujourdhui) {
  return trouver(index, motsCles(nom), aujourdhui, (motCherche, mot) => mot === motCherche);
}

/**
 * Recherche dans toutes les promos, pendant qu'on tape : chaque mot cherché doit être le début d'un
 * mot du produit ou de sa marque (« fro » trouve « Fromage »), ou un nom de famille complet
 * (« chips » trouve aussi « Pringles »). Sans rien à chercher : toutes les promos, celles en cours
 * d'abord. « magasin » : « lidl », « leclerc » ou vide pour les deux.
 * Même ordre que chercherPromos. Renvoie [{ offre, aVenir }].
 */
export function rechercherPromos(index, texte, aujourdhui, { magasin = "" } = {}) {
  const mots = motsCles(texte);
  const resultats = mots.length
    ? trouver(index, mots, aujourdhui, (motCherche, mot) => mot.startsWith(motCherche))
    : toutes(index, aujourdhui);
  return magasin ? resultats.filter(({ offre }) => offre.source === magasin) : resultats;
}

function toutes(index, aujourdhui) {
  return (index ?? [])
    .filter(({ offre }) => !offre.date_fin || offre.date_fin >= aujourdhui)
    .map(({ offre }) => ({ offre, aVenir: Boolean(offre.date_debut && offre.date_debut > aujourdhui) }))
    .sort((a, b) => Number(a.aVenir) - Number(b.aVenir) || secondaire(a.offre) - secondaire(b.offre));
}

const egal = (motCherche, mot) => mot === motCherche;

/** 0 pour le magasin principal (Leclerc), 1 pour les autres. */
const secondaire = (offre) => Number(offre.source !== MAGASIN_PRINCIPAL);

function trouver(index, motsCherches, aujourdhui, correspond) {
  const groupes = regrouper(motsCherches);
  if (!index || groupes.length === 0) return [];
  const trouvees = [];
  for (const { offre, motsProduit, motsMarque } of index) {
    if (offre.date_fin && offre.date_fin < aujourdhui) continue;
    const motsOffre = [...motsProduit, ...motsMarque];
    const contient = (mots, comparer) => mots.every((m) => motsOffre.some((mot) => comparer(m, mot)));

    // Pour chaque groupe : ses propres mots, sinon un équivalent de sa famille (mots entiers).
    let parFamille = false;
    let premier = null;
    const tousTrouves = groupes.every((groupe, i) => {
      let trouve = contient(groupe.mots, correspond) ? groupe.mots : null;
      if (!trouve) {
        trouve = groupe.equivalents.find((mots) => contient(mots, egal)) ?? null;
        if (trouve) parFamille = true;
      }
      if (i === 0) premier = trouve;
      return trouve !== null;
    });
    if (!tousTrouves) continue;

    const position = motsProduit.findIndex((mot) => correspond(premier[0], mot));
    trouvees.push({
      offre,
      aVenir: Boolean(offre.date_debut && offre.date_debut > aujourdhui),
      parFamille,
      position: position === -1 ? Number.MAX_SAFE_INTEGER : position,
      // Le mot entier avant les mots qui commencent pareil : « Lait » avant « Laitue ».
      exact: contient(premier, egal),
      longueur: motsProduit.length,
    });
  }
  // Les plus proches d'abord ; à pertinence égale (nom qui commence par l'article, ou pas), Leclerc
  // avant Lidl.
  trouvees.sort(
    (a, b) =>
      Number(a.parFamille) - Number(b.parFamille) ||
      Number(a.position > 0) - Number(b.position > 0) ||
      secondaire(a.offre) - secondaire(b.offre) ||
      a.position - b.position ||
      Number(b.exact) - Number(a.exact) ||
      Number(a.aVenir) - Number(b.aVenir) ||
      a.longueur - b.longueur ||
      (a.offre.prix ?? Infinity) - (b.offre.prix ?? Infinity),
  );
  return trouvees.map(({ offre, aVenir }) => ({ offre, aVenir }));
}

/**
 * L'article à ajouter à la liste depuis une promo : le nom du produit, et une note courte qui
 * rappelle où, combien (le prix payé en caisse) et jusqu'à quand (« Leclerc · 2,25 € · jusqu'au 7 nov. »).
 */
export function articleDepuisPromo(offre, aujourdhui) {
  const nom = joliNom(offre.produit).slice(0, 100).trim();
  const prix = explicationPrix(offre).prix ?? offre.reduction;
  return {
    nom,
    note: [enseigne(offre), prix, periodeCourte(offre, aujourdhui)].filter(Boolean).join(" · ").slice(0, 200),
  };
}

// ---------------------------------------------------------------------------------------------
// Dates

/** La date du jour sur le téléphone, au format du fichier : « 2026-10-27 ». */
export function dateDuJour(maintenant = new Date()) {
  const deux = (n) => String(n).padStart(2, "0");
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
}

function versDate(iso) {
  const [annee, mois, jour] = iso.split("-").map(Number);
  return new Date(annee, mois - 1, jour);
}

function lendemain(iso) {
  const date = versDate(iso);
  date.setDate(date.getDate() + 1);
  return dateDuJour(date);
}

const JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** « mardi 28 octobre », « samedi 1er novembre ». */
export function formaterJour(dateOuIso) {
  const date = typeof dateOuIso === "string" ? versDate(dateOuIso) : dateOuIso;
  const texte = JOUR.format(date);
  return date.getDate() === 1 ? texte.replace(/\b1\b/, "1er") : texte;
}

const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** « 7 nov. », « 1er nov. ». */
function jourCourt(iso) {
  const date = versDate(iso);
  const texte = JOUR_COURT.format(date);
  return date.getDate() === 1 ? texte.replace(/\b1\b/, "1er") : texte;
}

/** La période en court, pour une note : « jusqu'au 7 nov. », « dès le 29 oct. ». */
export function periodeCourte(offre, aujourdhui) {
  const { date_debut: debut, date_fin: fin } = offre;
  if (debut && debut > aujourdhui) return `dès le ${jourCourt(debut)}`;
  return fin ? `jusqu'au ${jourCourt(fin)}` : "";
}

/** Quand profiter de la promo : « Jusqu'au mardi 28 octobre », « À partir de demain »… */
export function periode(offre, aujourdhui) {
  const { date_debut: debut, date_fin: fin } = offre;
  const demain = lendemain(aujourdhui);
  if (debut && debut > aujourdhui)
    return debut === demain ? "À partir de demain" : `À partir du ${formaterJour(debut)}`;
  if (!fin) return "";
  if (fin === aujourdhui) return "Dernier jour aujourd'hui";
  if (fin === demain) return "Jusqu'à demain";
  return `Jusqu'au ${formaterJour(fin)}`;
}

/** « aujourd'hui à 5 h 48 », « hier à 5 h 48 », « dimanche 25 octobre à 5 h 48 ». */
export function formaterMoment(date, maintenant = new Date()) {
  // Espaces insécables : « 5 h 48 » ne se coupe pas en fin de ligne.
  const heure = `${date.getHours()}\u00a0h\u00a0${String(date.getMinutes()).padStart(2, "0")}`;
  const jour = dateDuJour(date);
  const veille = new Date(maintenant);
  veille.setDate(veille.getDate() - 1);
  if (jour === dateDuJour(maintenant)) return `aujourd'hui à ${heure}`;
  if (jour === dateDuJour(veille)) return `hier à ${heure}`;
  return `${formaterJour(date)} à ${heure}`;
}

/** Date de passage du robot, et si elle est trop ancienne pour qu'on s'y fie. */
export function fraicheur(miseAJour, maintenant = new Date()) {
  const date = new Date(miseAJour);
  if (Number.isNaN(date.getTime())) return { date: null, ancienne: true };
  return { date, ancienne: maintenant - date > HEURES_AVANT_ALERTE * 3_600_000 };
}

/**
 * Phrases sur la date des promos : { info } à afficher discrètement, { alerte } si elles sont trop
 * anciennes (vide sinon).
 */
export function phrasesFraicheur(miseAJour, maintenant = new Date()) {
  const { date, ancienne } = fraicheur(miseAJour, maintenant);
  if (!date) return { info: "", alerte: "Date des promos inconnue : elles ont pu changer." };
  const moment = formaterMoment(date, maintenant);
  const relatif = /^(aujourd'hui|hier)/.test(moment);
  const depuis = relatif ? `d'${moment}` : `du ${moment}`;
  return {
    info: `Promos : ${moment}`,
    alerte: ancienne ? `Promos ${depuis} : elles ont pu changer.` : "",
  };
}

/** Magasins dont les promos n'ont pas pu être lues en entier au dernier passage : [{ nom, etat }]. */
export function sourcesEnDifficulte(donnees) {
  return (donnees?.sources ?? [])
    .filter((source) => source.etat !== "ok")
    .map((source) => ({ nom: donnees.magasins?.[source.magasin]?.nom ?? source.nom, etat: source.etat }));
}

/**
 * Explique le problème d'un magasin. Le robot garde alors les promos encore valables de son
 * passage précédent (voir le README, « Fiabilité »).
 */
export function phraseSource({ nom, etat }) {
  return etat === "partiel" ? `Promos ${nom} incomplètes.` : `Promos ${nom} pas à jour.`;
}

// ---------------------------------------------------------------------------------------------
// Affichage

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const UNITES = { kg: "kg", l: "L", pièce: "pièce" };

/** « 0,89 € ». */
export function formaterPrix(montant) {
  return EUROS.format(montant);
}

/** « 9,43 €/kg », « 0,92 €/L ». */
export function formaterPrixUnitaire(montant, unite) {
  return `${formaterPrix(montant)}/${UNITES[unite] ?? unite}`;
}

// Sigles qui restent en majuscules.
const SIGLES = new Set(["aoc", "aop", "hd", "igp", "led", "pc", "tv", "uht", "usb", "xl", "xxl"]);

/** « LAIT DEMI-ÉCRÉMÉ UHT » → « Lait demi-écrémé UHT » (les noms tout en majuscules crient). */
export function joliNom(texte) {
  const nom = String(texte ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (/\p{Ll}/u.test(nom) || !/\p{Lu}{2}/u.test(nom)) return nom;
  const minuscules = nom
    .toLocaleLowerCase("fr-FR")
    .replace(/[\p{L}\d]+/gu, (mot) => (SIGLES.has(mot) ? mot.toUpperCase() : mot));
  return minuscules.charAt(0).toLocaleUpperCase("fr-FR") + minuscules.slice(1);
}

const ENSEIGNES = { lidl: "Lidl", leclerc: "Leclerc" };

/** « Lidl », « Leclerc ». */
export function enseigne(offre) {
  return ENSEIGNES[offre.source] ?? offre.source;
}

/**
 * Comment marche le prix d'une promo, en clair : ce qu'on paie en caisse et où va la réduction.
 * Renvoie { genre, prix, mention, barre, avantage } :
 * - genre : « caisse » (déjà déduit en caisse), « lot » (en caisse, en prenant plusieurs),
 *   « carte-leclerc » (crédité sur la carte E.Leclerc), « carte-caisse » (en caisse avec la carte
 *   E.Leclerc), « lidl-plus » (avec l'appli Lidl Plus) ou « aucun » (prix du catalogue) ;
 * - prix : le prix à afficher en gros, et mention : ce qu'il représente (« en caisse »…) ;
 * - barre : l'ancien prix à barrer, ou null ; unitaire : le prix au kilo qui va avec le gros prix ;
 * - avantage : la phrase qui explique la réduction, ou null.
 */
export function explicationPrix(offre) {
  const reduction = (offre.reduction ?? "").replace(/\s*avec Lidl Plus$/i, "");
  const euros = (montant) => (montant == null ? null : formaterPrix(montant));
  // Prix du lot, sauf s'il est douteux (« -50 % sur le 2e » au même prix qu'un seul : erreur du catalogue).
  const lotFiable =
    offre.lot?.prix != null && (offre.prix == null || offre.lot.prix > offre.prix || /offert/i.test(reduction));
  const auKiloDuLot =
    lotFiable && offre.lot.prix_unitaire != null && offre.unite && offre.unite !== "pièce"
      ? ` (${formaterPrixUnitaire(offre.lot.prix_unitaire, offre.unite)})`
      : "";
  const lot = lotFiable ? `${euros(offre.lot.prix)} les ${offre.lot.quantite}${auKiloDuLot}` : null;

  if (/ticket/i.test(reduction)) {
    // Le robot donne le prix une fois le Ticket déduit, et le prix payé en caisse en « ancien prix ».
    const enCaisse = offre.ancien_prix ?? offre.prix;
    const rendu = offre.ancien_prix != null && offre.prix != null ? offre.ancien_prix - offre.prix : null;
    const detail = reduction.replace(/\s*en Ticket E\.Leclerc/i, "");
    // Le prix au kilo du robot est celui une fois le Ticket déduit : on le met avec ce prix-là.
    const auKilo = prixUnitaire(offre) ? ` (${prixUnitaire(offre)})` : "";
    return {
      genre: "carte-leclerc",
      prix: euros(enCaisse),
      mention: enCaisse != null ? "en caisse" : null,
      barre: null,
      unitaire: null,
      avantage:
        rendu != null
          ? `${euros(rendu)} (${detail}) rendus sur la carte · revient à ${euros(offre.prix)}${auKilo}`
          : `${detail} rendus sur la carte`,
    };
  }
  if (offre.source === "lidl" && offre.carte_fidelite) {
    return {
      genre: "lidl-plus",
      prix: euros(offre.prix),
      mention: offre.lot ? "l'unité" : "avec Lidl Plus",
      barre: null,
      unitaire: prixUnitaire(offre),
      avantage: offre.lot
        ? `${reduction}${lot ? ` : ${lot}` : ""}`
        : offre.ancien_prix != null
          ? `Sans l'appli : ${euros(offre.ancien_prix)}`
          : "À scanner en caisse",
    };
  }
  if (offre.lot) {
    return {
      genre: offre.carte_fidelite ? "carte-caisse" : "lot",
      prix: euros(offre.prix),
      mention: offre.prix != null ? "l'unité" : null,
      barre: null,
      unitaire: prixUnitaire(offre),
      avantage: `${reduction}${lot ? ` : ${lot}` : ""}`,
    };
  }
  if (offre.ancien_prix != null || reduction) {
    const carte = offre.carte_fidelite;
    return {
      genre: carte ? "carte-caisse" : "caisse",
      prix: euros(offre.prix),
      mention: offre.prix != null ? "en caisse" : null,
      barre: euros(offre.ancien_prix),
      unitaire: prixUnitaire(offre),
      avantage: `${reduction ? `${reduction}, d` : "D"}éjà déduit`,
    };
  }
  return {
    genre: "aucun",
    prix: euros(offre.prix),
    mention: null,
    barre: null,
    unitaire: prixUnitaire(offre),
    avantage: null,
  };
}

/**
 * La description d'une promo sans ce qui répète le prix (prix au kilo, « Par 2 : … », « au lieu
 * de … ») : « 4 tranches. 140 g.Le kg : 11,36 €.Par 2 (280 g) : 2,38 € au lieu de 3,18 € » →
 * « 4 tranches · 140 g ».
 */
export function resumeDescription(texte) {
  const PRIX = String.raw`\d+(?:[.,]\d+)?\s*€`;
  return String(texte ?? "")
    .replace(/\([^()]*€[^()]*\)/g, " · ") // « (1 kg = 7,96 €) »
    .replace(new RegExp(String.raw`(?:avec Lidl Plus\s+)?au lieu de\s*${PRIX}?`, "gi"), " · ")
    .replace(new RegExp(String.raw`\bLes\s+\d+\s+produits?(?:\s+dont\s+\d+\s+offerts?)?\s*:\s*${PRIX}`, "gi"), " · ")
    .replace(new RegExp(String.raw`\bPar\s+\d+\s*(?:\([^)]*\))?\s*:\s*${PRIX}`, "gi"), " · ")
    .replace(new RegExp(String.raw`\bL[ea]\s+(?:kg|L|litre|pièce)\s*:\s*${PRIX}`, "gi"), " · ")
    .replace(/\bLe produit de\s+/gi, "")
    .replace(new RegExp(String.raw`\s*:\s*${PRIX}`, "g"), " · ")
    .replace(/(?:Même promotion disponible|[EÉ]galement disponible)[^.]*\.?/gi, " · ")
    .replace(/avec Lidl Plus/gi, " · ")
    .replace(/(?<!\d)\.\s*(?=\d)/g, " · ") // « 4 tranches. 140 g » → « 4 tranches · 140 g », mais pas « 1.98 L »
    .replace(/\s*\.?\s*(?:·\s*)+/g, " · ")
    .replace(/\s+/g, " ")
    .replace(/^[\s·.,;:]+|[\s·,;:]+$/g, "")
    .replace(/\.$/, "");
}

/**
 * Le prix au kilo, au litre…, pour comparer (« 9,43 €/kg ») ; rien s'il est égal au prix (produit
 * vendu au kilo ou à la pièce : il n'apprendrait rien).
 */
export function prixUnitaire(offre) {
  const { prix_unitaire: montant, unite, prix } = offre;
  if (montant == null || !unite || montant === prix) return null;
  return formaterPrixUnitaire(montant, unite);
}
