// Tests des règles d'accès Firestore, sur l'émulateur Firebase (jamais sur la vraie base).
// Lancement : npm test (dans le dossier firebase/)

import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";

import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";

const COMPTE_1 = "ElRK8CEajUMQmtajHXv5qZVVT6G2";
const COMPTE_2 = "XABqepPEkHXg8gBon5ljE5XEXOD3";
const INCONNU = "quelqu-un-d-autre";

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-promos-courses",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

after(async () => {
  await env.cleanup();
});

const base = (uid) => env.authenticatedContext(uid).firestore();

function nouvelArticle(uid, champs = {}) {
  return {
    nom: "Lait demi-écrémé",
    quantite: "2 L",
    achete: false,
    ajoute_par: uid,
    cree_le: serverTimestamp(),
    modifie_le: serverTimestamp(),
    ...champs,
  };
}

async function articleExistant(uid = COMPTE_1) {
  await env.withSecurityRulesDisabled(async (contexte) => {
    await setDoc(doc(contexte.firestore(), "articles/lait"), {
      nom: "Lait",
      achete: false,
      ajoute_par: uid,
      cree_le: Timestamp.fromDate(new Date("2026-10-26T20:00:00Z")),
      modifie_le: Timestamp.fromDate(new Date("2026-10-26T20:00:00Z")),
    });
  });
}

describe("accès au foyer", () => {
  test("Les deux comptes du foyer peuvent lire la liste", async () => {
    await articleExistant();
    await assertSucceeds(getDoc(doc(base(COMPTE_1), "articles/lait")));
    await assertSucceeds(getDoc(doc(base(COMPTE_2), "articles/lait")));
  });

  test("une personne non connectée ne peut rien lire ni écrire", async () => {
    await articleExistant();
    const anonyme = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonyme, "articles/lait")));
    await assertFails(setDoc(doc(anonyme, "articles/pain"), nouvelArticle(INCONNU)));
  });

  test("un autre compte Firebase ne peut rien lire ni écrire", async () => {
    await articleExistant();
    await assertFails(getDoc(doc(base(INCONNU), "articles/lait")));
    await assertFails(setDoc(doc(base(INCONNU), "articles/pain"), nouvelArticle(INCONNU)));
    await assertFails(deleteDoc(doc(base(INCONNU), "articles/lait")));
  });

  test("les autres collections sont fermées", async () => {
    await assertFails(setDoc(doc(base(COMPTE_1), "secret/x"), { a: 1 }));
    await assertFails(getDoc(doc(base(COMPTE_1), "secret/x")));
  });
});

describe("ajouter un article", () => {
  test("un article bien formé est accepté", async () => {
    await assertSucceeds(setDoc(doc(base(COMPTE_2), "articles/pain"), nouvelArticle(COMPTE_2)));
  });

  test("on ne peut pas ajouter un article au nom de l'autre", async () => {
    await assertFails(setDoc(doc(base(COMPTE_2), "articles/pain"), nouvelArticle(COMPTE_1)));
  });

  test("le nom est obligatoire et limité à 100 caractères", async () => {
    await assertFails(setDoc(doc(base(COMPTE_1), "articles/a"), nouvelArticle(COMPTE_1, { nom: "" })));
    await assertFails(setDoc(doc(base(COMPTE_1), "articles/b"), nouvelArticle(COMPTE_1, { nom: "x".repeat(101) })));
    await assertFails(setDoc(doc(base(COMPTE_1), "articles/c"), nouvelArticle(COMPTE_1, { nom: 42 })));
  });

  test("les dates doivent être celles du serveur", async () => {
    const hier = Timestamp.fromDate(new Date("2026-10-25T10:00:00Z"));
    await assertFails(setDoc(doc(base(COMPTE_1), "articles/a"), nouvelArticle(COMPTE_1, { cree_le: hier })));
    await assertFails(setDoc(doc(base(COMPTE_1), "articles/b"), nouvelArticle(COMPTE_1, { modifie_le: hier })));
  });

  test("les champs inconnus sont refusés", async () => {
    await assertFails(setDoc(doc(base(COMPTE_1), "articles/a"), nouvelArticle(COMPTE_1, { pirate: true })));
  });

  test("la quantité et la note sont facultatives mais limitées", async () => {
    const { quantite, ...sansQuantite } = nouvelArticle(COMPTE_1);
    await assertSucceeds(setDoc(doc(base(COMPTE_1), "articles/a"), sansQuantite));
    await assertSucceeds(setDoc(doc(base(COMPTE_1), "articles/b"), nouvelArticle(COMPTE_1, { note: "sans lactose" })));
    await assertFails(setDoc(doc(base(COMPTE_1), "articles/c"), nouvelArticle(COMPTE_1, { quantite: "x".repeat(31) })));
  });
});

describe("modifier ou supprimer un article", () => {
  test("un compte peut cocher un article ajouté par l'autre", async () => {
    await articleExistant(COMPTE_1);
    await assertSucceeds(
      updateDoc(doc(base(COMPTE_2), "articles/lait"), { achete: true, modifie_le: serverTimestamp() }),
    );
  });

  test("on ne peut pas changer l'auteur ni la date de création", async () => {
    await articleExistant(COMPTE_1);
    const ref = doc(base(COMPTE_2), "articles/lait");
    await assertFails(updateDoc(ref, { ajoute_par: COMPTE_2, modifie_le: serverTimestamp() }));
    await assertFails(updateDoc(ref, { cree_le: serverTimestamp(), modifie_le: serverTimestamp() }));
  });

  test("la date de modification doit être mise à jour", async () => {
    await articleExistant(COMPTE_1);
    await assertFails(updateDoc(doc(base(COMPTE_2), "articles/lait"), { achete: true }));
  });

  test("le foyer peut supprimer un article", async () => {
    await articleExistant(COMPTE_1);
    await assertSucceeds(deleteDoc(doc(base(COMPTE_2), "articles/lait")));
  });
});

describe("réglages", () => {
  test("le foyer peut lire et écrire ses réglages, pas les autres", async () => {
    await assertSucceeds(setDoc(doc(base(COMPTE_1), "reglages/foyer"), { lidl_plus: true }));
    await assertSucceeds(getDoc(doc(base(COMPTE_2), "reglages/foyer")));
    await assertFails(getDoc(doc(base(INCONNU), "reglages/foyer")));
  });
});
