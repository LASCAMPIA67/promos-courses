// Lecture et modification de la liste de courses commune dans Firestore.
// Forme des données : docs/liste-commune.md (collections « articles », « membres » et « tickets »).

import {
  Bytes,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { assembler, decouper } from "./tickets.js";

/** Suit la liste en direct : `rappel` est appelé à chaque changement, venant de ce téléphone ou de l'autre. */
export function suivreArticles(db, rappel, enCasErreur) {
  return onSnapshot(
    collection(db, "articles"),
    { includeMetadataChanges: true },
    (instantane) => {
      const articles = instantane.docs.map((d) => ({
        id: d.id,
        ...d.data({ serverTimestamps: "estimate" }),
        enAttente: d.metadata.hasPendingWrites,
      }));
      rappel(articles, { depuisLeTelephone: instantane.metadata.fromCache });
    },
    enCasErreur,
  );
}

/** Ajoute un article ; « achete » sert à remettre un article supprimé par erreur depuis le caddie. */
export function ajouterArticle(db, uid, article, { achete = false } = {}) {
  return addDoc(collection(db, "articles"), {
    ...article,
    achete,
    ajoute_par: uid,
    cree_le: serverTimestamp(),
    modifie_le: serverTimestamp(),
  });
}

export function cocherArticle(db, article, achete = !article.achete) {
  return updateDoc(doc(db, "articles", article.id), { achete, modifie_le: serverTimestamp() });
}

export function modifierArticle(db, id, { nom, quantite, note }) {
  return updateDoc(doc(db, "articles", id), {
    nom,
    quantite: quantite ?? deleteField(),
    note: note ?? deleteField(),
    modifie_le: serverTimestamp(),
  });
}

export function supprimerArticle(db, id) {
  return deleteDoc(doc(db, "articles", id));
}

/** Suit les fiches des membres du foyer (prénom et couleur) : `rappel` reçoit { uid: fiche }. */
export function suivreMembres(db, rappel, enCasErreur) {
  return onSnapshot(
    collection(db, "membres"),
    (instantane) => rappel(Object.fromEntries(instantane.docs.map((d) => [d.id, d.data()]))),
    enCasErreur,
  );
}

/** Enregistre sa propre fiche : { prenom, couleur }. */
export function enregistrerMembre(db, uid, fiche) {
  return setDoc(doc(db, "membres", uid), fiche);
}

/** Retire d'un coup tous les articles déjà dans le caddie. */
export function viderLeCaddie(db, articles) {
  const lot = writeBatch(db);
  for (const article of articles) lot.delete(doc(db, "articles", article.id));
  return lot.commit();
}

/** Suit les tickets de caisse (les fiches seulement, sans leur fichier) : `rappel` reçoit la liste. */
export function suivreTickets(db, rappel, enCasErreur) {
  return onSnapshot(
    collection(db, "tickets"),
    { includeMetadataChanges: true },
    (instantane) =>
      rappel(
        instantane.docs.map((d) => ({
          id: d.id,
          ...d.data({ serverTimestamps: "estimate" }),
          enAttente: d.metadata.hasPendingWrites,
        })),
      ),
    enCasErreur,
  );
}

/**
 * Ajoute un ticket : sa fiche et son fichier (Uint8Array), découpé en morceaux, envoyés ensemble
 * (tout ou rien). Sans réseau, le ticket est gardé et envoyé plus tard. Renvoie l'envoi en cours.
 */
export function ajouterTicket(db, uid, fiche, { octets, type }) {
  const ticket = doc(collection(db, "tickets"));
  const morceaux = decouper(octets);
  const lot = writeBatch(db);
  lot.set(ticket, {
    ...fiche,
    type,
    taille: octets.length,
    morceaux: morceaux.length,
    ajoute_par: uid,
    cree_le: serverTimestamp(),
  });
  morceaux.forEach((morceau, rang) =>
    lot.set(doc(ticket, "morceaux", String(rang)), { donnees: Bytes.fromUint8Array(morceau) }),
  );
  return { id: ticket.id, envoi: lot.commit() };
}

/** Corrige le magasin, la date, le montant ou la note d'un ticket. */
export function modifierTicket(db, id, { magasin, date_achat, montant, note }) {
  return updateDoc(doc(db, "tickets", id), {
    magasin,
    date_achat,
    montant: montant ?? deleteField(),
    note: note ?? deleteField(),
  });
}

/** Le fichier d'un ticket, recollé à partir de ses morceaux (depuis le téléphone s'il y est déjà). */
export async function lireFichierTicket(db, ticket) {
  const instantane = await getDocs(collection(db, "tickets", ticket.id, "morceaux"));
  const morceaux = instantane.docs
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((d) => d.data().donnees.toUint8Array());
  if (morceaux.length !== ticket.morceaux)
    throw new Error("Ticket incomplet : il n'est pas encore arrivé sur ce téléphone.");
  return new Blob([assembler(morceaux)], { type: ticket.type });
}

/** Supprime un ticket et son fichier. */
export function supprimerTicket(db, ticket) {
  const lot = writeBatch(db);
  lot.delete(doc(db, "tickets", ticket.id));
  for (let rang = 0; rang < ticket.morceaux; rang += 1)
    lot.delete(doc(db, "tickets", ticket.id, "morceaux", String(rang)));
  return lot.commit();
}
