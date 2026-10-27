// Les tickets de caisse : règles simples, sans Firebase ni navigateur (faciles à tester).
//
// Un ticket est gardé dans Firestore (jamais dans ce dépôt public) : une fiche dans « tickets »
// (magasin, date, montant…) et son fichier (photo allégée ou PDF) découpé en morceaux dans
// « tickets/{id}/morceaux », car un document Firestore ne dépasse pas 1 Mio. Voir docs/liste-commune.md.

export const MAGASINS_TICKET = {
  leclerc: "Leclerc",
  lidl: "Lidl",
  autre: "Autre magasin",
};

/** Taille maximale d'un fichier de ticket (5 Mio) : bien plus qu'une photo allégée ou un PDF de ticket. */
export const TAILLE_MAX = 5 * 1024 * 1024;

/** Taille d'un morceau : un peu moins de 1 Mio, la limite d'un document Firestore. */
export const TAILLE_MORCEAU = 900_000;

/** Les tickets montrés directement sous la liste ; les autres sont dans « Voir tous les tickets ». */
export const TICKETS_SOUS_LA_LISTE = 3;

export const MONTANT_MAX = 10_000;

/** Découpe un fichier (Uint8Array) en morceaux d'au plus `taille` octets. */
export function decouper(octets, taille = TAILLE_MORCEAU) {
  const morceaux = [];
  for (let debut = 0; debut < octets.length; debut += taille) morceaux.push(octets.subarray(debut, debut + taille));
  return morceaux;
}

/** Recolle les morceaux (dans l'ordre) en un seul fichier. */
export function assembler(morceaux) {
  const total = morceaux.reduce((somme, m) => somme + m.length, 0);
  const octets = new Uint8Array(total);
  let position = 0;
  for (const morceau of morceaux) {
    octets.set(morceau, position);
    position += morceau.length;
  }
  return octets;
}

/** « 54,30 », « 54.3 », « 54,30 € » → 54.3 ; vide → null ; incompréhensible → NaN. */
export function lireMontant(texte) {
  const propre = String(texte ?? "")
    .replace(/[\s€]/g, "")
    .replace(",", ".");
  if (!propre) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return Number.NaN;
  return Number(propre);
}

/** Le magasin le plus probable d'après le nom du fichier (« ticket-lidl.pdf »…), sinon Leclerc, notre magasin principal. */
export function devinerMagasin(nomFichier) {
  return String(nomFichier ?? "")
    .toLowerCase()
    .includes("lidl")
    ? "lidl"
    : "leclerc";
}

/** Vérifie ce qui a été saisi : { fiche } (prête pour Firestore, sans le fichier) ou { erreur }. */
export function preparerTicket({ magasin, date, montant, note }, aujourdhui) {
  if (!(magasin in MAGASINS_TICKET)) return { erreur: "Choisissez le magasin." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || Number.isNaN(new Date(`${date}T12:00`).getTime())) {
    return { erreur: "Indiquez la date des courses." };
  }
  if (date > aujourdhui) return { erreur: "La date des courses ne peut pas être dans le futur." };
  const valeur = lireMontant(montant);
  if (Number.isNaN(valeur) || valeur > MONTANT_MAX) return { erreur: "Montant incompréhensible (exemple : 54,30)." };
  const fiche = { magasin, date_achat: date };
  if (valeur != null) fiche.montant = valeur;
  const texte = String(note ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  if (texte) fiche.note = texte;
  return { fiche };
}

const MOIS = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
const LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

const date = (iso) => new Date(`${iso}T12:00`);

export const formaterMontant = (montant) => EUROS.format(montant);

/** « Leclerc · mar. 27/10 · 54,30 € », pour la liste des tickets. */
export function libelleTicket(ticket) {
  return [
    MAGASINS_TICKET[ticket.magasin] ?? "Ticket",
    JOUR.format(date(ticket.date_achat)),
    ticket.montant != null ? formaterMontant(ticket.montant) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** « mardi 27 octobre 2026 », pour le titre d'un ticket ouvert. */
export const jourEnLettres = (iso) => LONG.format(date(iso));

/** Le plus récent d'abord : par date des courses, puis par date d'ajout. */
export function trierTickets(tickets) {
  const ajout = (t) => t.cree_le?.toMillis?.() ?? 0;
  return [...tickets].sort((a, b) => b.date_achat.localeCompare(a.date_achat) || ajout(b) - ajout(a));
}

/** Les tickets regroupés par mois : [{ mois: « octobre 2026 », tickets }], le plus récent d'abord. */
export function regrouperParMois(tickets) {
  const groupes = new Map();
  for (const ticket of trierTickets(tickets)) {
    const mois = MOIS.format(date(ticket.date_achat));
    if (!groupes.has(mois)) groupes.set(mois, []);
    groupes.get(mois).push(ticket);
  }
  return [...groupes].map(([mois, liste]) => ({ mois: mois.charAt(0).toUpperCase() + mois.slice(1), tickets: liste }));
}

/**
 * La taille d'une photo allégée : assez large pour lire chaque ligne d'un ticket (1 400 pixels),
 * pas plus haute que ce que l'iPhone sait dessiner (4 096 pixels), sans jamais agrandir.
 */
export function dimensionsReduites(largeur, hauteur, { largeurMax = 1400, hauteurMax = 4096 } = {}) {
  const echelle = Math.min(1, largeurMax / largeur, hauteurMax / hauteur);
  return { largeur: Math.round(largeur * echelle), hauteur: Math.round(hauteur * echelle) };
}

/** « 312 Ko », « 1,2 Mo ». */
export function formaterTaille(octets) {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

// ---------------------------------------------------------------------------------------------
// Lecture automatique : le total, la date et le magasin, trouvés dans le texte du ticket (lu sur la
// photo, ou dans le PDF).

const MONTANT = /(\d{1,4})\s?[,.]\s?(\d{2})(?!\d)/g;

/** Les lignes qui donnent le total, de la plus sûre à la moins sûre. */
const LIGNES_TOTAL = [
  /(net|total)\s*(a|à)\s*payer/i,
  /\bt[o0]ta[l1i]\b/i,
  /\bmontant\b/i,
  /\b(cb|carte bancaire|carte|esp[eè]ces)\b/i,
];

/** Les « totaux » qui n'en sont pas : sous-total, remises, TVA… */
const FAUX_TOTAUX = /sous[\s-]?t[o0]tal|total\s*(des\s*)?(remises?|[ée]conomies?|tva|ht|articles?|points?|avantages?)/i;

function montantDeLaLigne(ligne) {
  const montants = [...ligne.matchAll(MONTANT)].map(([, euros, centimes]) => Number(`${euros}.${centimes}`));
  return montants.at(-1) ?? null;
}

/**
 * Ce qu'on peut lire sur un ticket : { magasin, date, montant }, chacun null s'il n'est pas trouvé.
 * `aujourdhui` (« 2026-10-27 ») écarte les dates impossibles (futures, ou de plus de deux ans).
 */
export function lireTicket(texte, aujourdhui) {
  const lignes = String(texte ?? "")
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter(Boolean);
  const tout = lignes.join("\n");

  const magasin = /lidl/i.test(tout) ? "lidl" : /leclerc/i.test(tout) ? "leclerc" : null;

  let montant = null;
  for (const motif of LIGNES_TOTAL) {
    const rang = lignes.findIndex((ligne) => motif.test(ligne) && !FAUX_TOTAUX.test(ligne));
    if (rang === -1) continue;
    // Le montant est sur la ligne, ou juste en dessous quand la lecture l'a renvoyé à la ligne.
    montant = montantDeLaLigne(lignes[rang]) ?? montantDeLaLigne(lignes[rang + 1] ?? "");
    if (montant != null && montant > 0 && montant <= MONTANT_MAX) break;
    montant = null;
  }

  let date = null;
  const ilYADeuxAns = `${Number(aujourdhui.slice(0, 4)) - 2}${aujourdhui.slice(4)}`;
  for (const [, jour, mois, annee] of tout.matchAll(/\b(\d{2})[/.-](\d{2})[/.-](\d{4}|\d{2})\b/g)) {
    const iso = `${annee.length === 2 ? `20${annee}` : annee}-${mois}-${jour}`;
    const valide = new Date(`${iso}T12:00`);
    if (Number.isNaN(valide.getTime()) || valide.getDate() !== Number(jour)) continue;
    if (iso > aujourdhui || iso < ilYADeuxAns) continue;
    date = iso;
    break;
  }
  return { magasin, date, montant };
}
