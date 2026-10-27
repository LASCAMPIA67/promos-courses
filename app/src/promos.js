// Les promos de nos magasins (fichier promos.json, écrit chaque matin par le robot) et leur
// comparaison avec la liste de courses. Sans Firebase ni réseau : facile à tester.

/** Le fichier promos.json du dépôt, tel que le robot l'enregistre chaque matin. */
export const URL_PROMOS = "https://raw.githubusercontent.com/LASCAMPIA67/promos-courses/main/promos.json";

/** Version du format de promos.json que l'appli sait lire (voir docs/format-promos.md). */
export const FORMAT = 2;

/** Le robot passe chaque matin : au-delà de ce délai, il a manqué au moins un passage. */
export const HEURES_AVANT_ALERTE = 36;

// Petits mots et unités qui ne disent rien du produit.
const MOTS_VIDES = new Set([
  "a", "au", "aux", "avec", "d", "de", "des", "du", "en", "et", "l", "la", "le", "les", "ou", "par",
  "pour", "sans", "sur", "un", "une", "cl", "kg", "ml",
]);

/**
 * Mots-clés d'un texte, pour comparer un article de la liste aux produits en promo :
 * « Œufs frais de la ferme » → ["oeuf", "frai", "ferme"].
 * Minuscules, sans accents, sans petits mots ni nombres, et au singulier (s ou x final retiré).
 */
export function motsCles(texte) {
  return String(texte ?? "")
    .toLowerCase()
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

/**
 * Les promos qui correspondent à un article de la liste : tous les mots de l'article doivent se
 * retrouver dans le nom du produit ou sa marque. Les promos terminées sont écartées.
 * Les plus proches d'abord : celles dont le nom commence par l'article (« Lait demi-écrémé » avant
 * « Chocolat au lait »), celles en cours avant celles à venir, puis les noms les plus courts.
 * Renvoie [{ offre, aVenir }].
 */
export function chercherPromos(index, nom, aujourdhui) {
  const mots = [...new Set(motsCles(nom))];
  if (!index || mots.length === 0) return [];
  const trouvees = [];
  for (const { offre, motsProduit, motsMarque } of index) {
    if (offre.date_fin && offre.date_fin < aujourdhui) continue;
    if (!mots.every((mot) => motsProduit.includes(mot) || motsMarque.has(mot))) continue;
    const position = motsProduit.indexOf(mots[0]);
    trouvees.push({
      offre,
      aVenir: Boolean(offre.date_debut && offre.date_debut > aujourdhui),
      position: position === -1 ? Number.MAX_SAFE_INTEGER : position,
      longueur: motsProduit.length,
    });
  }
  trouvees.sort(
    (a, b) =>
      a.position - b.position ||
      Number(a.aVenir) - Number(b.aVenir) ||
      a.longueur - b.longueur ||
      (a.offre.prix ?? Infinity) - (b.offre.prix ?? Infinity),
  );
  return trouvees.map(({ offre, aVenir }) => ({ offre, aVenir }));
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

/** Quand profiter de la promo : « Jusqu'au mardi 28 octobre », « À partir de demain »… */
export function periode(offre, aujourdhui) {
  const { date_debut: debut, date_fin: fin } = offre;
  const demain = lendemain(aujourdhui);
  if (debut && debut > aujourdhui) return debut === demain ? "À partir de demain" : `À partir du ${formaterJour(debut)}`;
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
  if (!date) return { info: "", alerte: "La date des promos est inconnue : elles ont pu changer." };
  const moment = formaterMoment(date, maintenant);
  const relatif = /^(aujourd'hui|hier)/.test(moment);
  const depuis = relatif ? `d'${moment}` : `du ${moment}`;
  return {
    info: `Promos Lidl et Leclerc lues par le robot ${relatif ? moment : `le ${moment}`}.`,
    alerte: ancienne ? `Les promos datent ${depuis} : le robot n'est pas passé depuis, elles ont pu changer.` : "",
  };
}

/** Magasins dont les promos n'ont pas pu être lues en entier ce matin : [{ nom, etat }]. */
export function sourcesEnDifficulte(donnees) {
  return (donnees?.sources ?? [])
    .filter((source) => source.etat !== "ok")
    .map((source) => ({ nom: donnees.magasins?.[source.magasin]?.nom ?? source.nom, etat: source.etat }));
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
  const nom = String(texte ?? "").replace(/\s+/g, " ").trim();
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

/** Détails utiles pour comparer : prix au kilo, prix par lot, carte de fidélité. */
export function infosPromo(offre) {
  const infos = [];
  if (offre.prix_unitaire != null && offre.unite && !(offre.unite === "pièce" && offre.prix_unitaire === offre.prix)) {
    infos.push(formaterPrixUnitaire(offre.prix_unitaire, offre.unite));
  }
  if (offre.lot) {
    const { quantite, prix, prix_unitaire: prixUnitaire } = offre.lot;
    const auKilo = offre.unite && offre.unite !== "pièce" ? ` (${formaterPrixUnitaire(prixUnitaire, offre.unite)})` : "";
    infos.push(`Par ${quantite} : ${formaterPrix(prix)}${auKilo}`);
  }
  if (offre.carte_fidelite && !/lidl plus|ticket/i.test(offre.reduction ?? "")) {
    infos.push(offre.source === "lidl" ? "avec Lidl Plus" : "avec la carte E.Leclerc");
  }
  return infos;
}

/** « 3 promos : 2 chez Lidl, 1 chez Leclerc ». */
export function resumePromos(promos) {
  const parEnseigne = new Map();
  for (const { offre } of promos) parEnseigne.set(enseigne(offre), (parEnseigne.get(enseigne(offre)) ?? 0) + 1);
  const total = `${promos.length} promo${promos.length > 1 ? "s" : ""}`;
  if (parEnseigne.size < 2) return `${total} chez ${[...parEnseigne.keys()][0] ?? "nos magasins"}`;
  return `${total} : ${[...parEnseigne].map(([nom, nombre]) => `${nombre} chez ${nom}`).join(", ")}`;
}
