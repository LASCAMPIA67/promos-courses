// Lecture et modification de la liste de courses commune dans Firestore.
// Forme des données : docs/liste-commune.md (collection « articles »).

import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
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

export function ajouterArticle(db, uid, article) {
  return addDoc(collection(db, "articles"), {
    ...article,
    achete: false,
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

/** Retire d'un coup tous les articles déjà dans le caddie. */
export function viderLeCaddie(db, articles) {
  const lot = writeBatch(db);
  for (const article of articles) lot.delete(doc(db, "articles", article.id));
  return lot.commit();
}
