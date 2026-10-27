// Lecture et modification de la liste de courses commune dans Firestore.
// Forme des données : docs/liste-commune.md (collections « articles » et « membres »).

import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

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
