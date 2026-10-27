// Qui a ajouté quel article, et quand : prénom et couleur de chacun (fiches « membres » dans
// Firestore, jamais dans ce dépôt public), et la date d'ajout en clair. Sans Firebase : facile à tester.

/** Les couleurs qu'on peut choisir, dans l'ordre où elles sont données par défaut. */
export const COULEURS = ["vert", "violet", "bleu", "orange", "rose", "jaune"];

export const LONGUEUR_PRENOM = 30;

/**
 * La couleur d'un compte : celle qu'il a choisie, sinon une couleur donnée d'office selon l'ordre
 * des comptes (le même sur les deux téléphones).
 */
export function couleurDe(uid, membres, uids) {
  const choisie = membres[uid]?.couleur;
  if (COULEURS.includes(choisie)) return choisie;
  const rang = [...new Set(uids)].sort().indexOf(uid);
  return COULEURS[Math.max(rang, 0) % COULEURS.length];
}

/** Le prénom d'un compte, sinon « vous » ou « l'autre compte ». */
export function nomDe(uid, membres, moi) {
  return membres[uid]?.prenom || (uid === moi ? "vous" : "l'autre compte");
}

/** Vérifie la fiche saisie : { fiche } ou { erreur }. */
export function preparerFiche({ prenom, couleur }) {
  const propre = String(prenom ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!propre) return { erreur: "Écrivez votre prénom." };
  if (propre.length > LONGUEUR_PRENOM)
    return { erreur: `Prénom trop long (${LONGUEUR_PRENOM} caractères au maximum).` };
  if (!COULEURS.includes(couleur)) return { erreur: "Choisissez une couleur." };
  return { fiche: { prenom: propre, couleur } };
}

const deux = (n) => String(n).padStart(2, "0");
const memeJour = (a, b) => a.toDateString() === b.toDateString();
const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });

/**
 * Quand un article a été ajouté, en court : « aujourd'hui 13:38 », « hier 18:02 », « lun. 09:15 »
 * (cette semaine), « 12/10 09:15 » (avant).
 */
export function formaterAjout(date, maintenant = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const heure = `${deux(date.getHours())}:${deux(date.getMinutes())}`;
  const veille = new Date(maintenant);
  veille.setDate(veille.getDate() - 1);
  const ilYASixJours = new Date(maintenant);
  ilYASixJours.setDate(ilYASixJours.getDate() - 6);
  ilYASixJours.setHours(0, 0, 0, 0);
  if (memeJour(date, maintenant)) return `aujourd'hui ${heure}`;
  if (memeJour(date, veille)) return `hier ${heure}`;
  if (date >= ilYASixJours && date <= maintenant) return `${JOUR_COURT.format(date)} ${heure}`;
  return `${deux(date.getDate())}/${deux(date.getMonth() + 1)} ${heure}`;
}
