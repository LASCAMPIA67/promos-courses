// Tests des règles d'accès Firestore, sur l'émulateur Firebase (jamais sur la vraie base).
// Lancement : npm test (dans le dossier firebase/)

import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";

import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  Bytes,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

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

  test("la promo d'où vient l'article (son identifiant) est facultative mais limitée", async () => {
    const depuisUnePromo = nouvelArticle(COMPTE_1, { promo: "lidl-2026-10-22-80000" });
    await assertSucceeds(setDoc(doc(base(COMPTE_1), "articles/a"), depuisUnePromo));
    await assertFails(setDoc(doc(base(COMPTE_1), "articles/b"), nouvelArticle(COMPTE_1, { promo: "x".repeat(101) })));
    await assertFails(setDoc(doc(base(COMPTE_1), "articles/c"), nouvelArticle(COMPTE_1, { promo: 42 })));
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

describe("membres : prénom et couleur de chacun", () => {
  const fiche = { prenom: "Compte un", couleur: "vert" };

  test("chacun écrit sa propre fiche, et le foyer peut lire les deux", async () => {
    await assertSucceeds(setDoc(doc(base(COMPTE_1), `membres/${COMPTE_1}`), fiche));
    await assertSucceeds(getDoc(doc(base(COMPTE_2), `membres/${COMPTE_1}`)));
    await assertSucceeds(updateDoc(doc(base(COMPTE_1), `membres/${COMPTE_1}`), { couleur: "bleu" }));
    await assertSucceeds(deleteDoc(doc(base(COMPTE_1), `membres/${COMPTE_1}`)));
  });

  test("on ne peut pas écrire la fiche de l'autre", async () => {
    await assertFails(setDoc(doc(base(COMPTE_2), `membres/${COMPTE_1}`), fiche));
  });

  test("la fiche est contrôlée : prénom court, couleur connue, rien d'autre", async () => {
    const ma = (champs) => setDoc(doc(base(COMPTE_1), `membres/${COMPTE_1}`), champs);
    await assertFails(ma({ prenom: "", couleur: "vert" }));
    await assertFails(ma({ prenom: "x".repeat(31), couleur: "vert" }));
    await assertFails(ma({ prenom: "Compte un", couleur: "#ff0000" }));
    await assertFails(ma({ prenom: "Compte un" }));
    await assertFails(ma({ ...fiche, email: "compte@exemple.test" }));
  });

  test("un autre compte Firebase ne peut ni lire ni écrire les fiches", async () => {
    await assertFails(setDoc(doc(base(INCONNU), `membres/${INCONNU}`), fiche));
    await assertFails(getDoc(doc(base(INCONNU), `membres/${COMPTE_1}`)));
  });
});

describe("tickets de caisse", () => {
  const fichier = (taille) => Bytes.fromUint8Array(new Uint8Array(taille).fill(7));

  function nouveauTicket(uid, champs = {}) {
    return {
      magasin: "leclerc",
      date_achat: "2026-10-27",
      montant: 54.3,
      type: "image/jpeg",
      taille: 1_200_000,
      morceaux: 2,
      ajoute_par: uid,
      cree_le: serverTimestamp(),
      ...champs,
    };
  }

  /** La fiche et ses morceaux, envoyés ensemble comme le fait l'appli. */
  function ajouterTicket(db, fiche, morceaux = [fichier(900_000), fichier(300_000)]) {
    const lot = writeBatch(db);
    lot.set(doc(db, "tickets/t1"), fiche);
    morceaux.forEach((donnees, rang) => lot.set(doc(db, `tickets/t1/morceaux/${rang}`), { donnees }));
    return lot.commit();
  }

  test("un ticket et son fichier sont acceptés, et les deux comptes peuvent le lire", async () => {
    await assertSucceeds(ajouterTicket(base(COMPTE_1), nouveauTicket(COMPTE_1)));
    await assertSucceeds(getDoc(doc(base(COMPTE_2), "tickets/t1")));
    await assertSucceeds(getDoc(doc(base(COMPTE_2), "tickets/t1/morceaux/1")));
  });

  test("un PDF, sans montant ni note, en un seul morceau", async () => {
    const { montant, ...sansMontant } = nouveauTicket(COMPTE_2, { type: "application/pdf", taille: 1000, morceaux: 1 });
    await assertSucceeds(ajouterTicket(base(COMPTE_2), sansMontant, [fichier(1000)]));
  });

  test("la fiche est contrôlée", async () => {
    const essai = (champs) => ajouterTicket(base(COMPTE_1), nouveauTicket(COMPTE_1, champs));
    await assertFails(essai({ magasin: "carrefour" }));
    await assertFails(essai({ date_achat: "27/10/2026" }));
    await assertFails(essai({ montant: -3 }));
    await assertFails(essai({ type: "text/html" }));
    await assertFails(essai({ taille: 6 * 1024 * 1024 }));
    await assertFails(essai({ note: "x".repeat(201) }));
    await assertFails(essai({ pirate: true }));
    await assertFails(essai({ cree_le: Timestamp.fromDate(new Date("2026-10-25T10:00:00Z")) }));
    await assertFails(ajouterTicket(base(COMPTE_2), nouveauTicket(COMPTE_1)));
  });

  test("pas de morceau sans sa fiche, ni au-delà du nombre prévu, ni trop gros", async () => {
    await assertFails(setDoc(doc(base(COMPTE_1), "tickets/seul/morceaux/0"), { donnees: fichier(10) }));
    await assertFails(
      ajouterTicket(base(COMPTE_1), nouveauTicket(COMPTE_1), [fichier(900_000), fichier(200_000), fichier(100_000)]),
    );
    await assertFails(ajouterTicket(base(COMPTE_1), nouveauTicket(COMPTE_1, { morceaux: 1 }), [fichier(1_000_000)]));
    await assertFails(ajouterTicket(base(COMPTE_1), nouveauTicket(COMPTE_1, { morceaux: 1 }), [fichier(0)]));
  });

  test("on corrige le magasin, la date, le montant ou la note, jamais le fichier", async () => {
    await assertSucceeds(ajouterTicket(base(COMPTE_1), nouveauTicket(COMPTE_1)));
    const ref = doc(base(COMPTE_2), "tickets/t1");
    await assertSucceeds(updateDoc(ref, { magasin: "lidl", date_achat: "2026-10-26", montant: 12, note: "ok" }));
    await assertFails(updateDoc(ref, { taille: 10 }));
    await assertFails(updateDoc(ref, { ajoute_par: COMPTE_2 }));
    await assertFails(setDoc(doc(base(COMPTE_2), "tickets/t1/morceaux/0"), { donnees: fichier(10) }));
  });

  test("le foyer peut supprimer un ticket et son fichier ; un autre compte, rien", async () => {
    await assertSucceeds(ajouterTicket(base(COMPTE_1), nouveauTicket(COMPTE_1)));
    await assertFails(getDoc(doc(base(INCONNU), "tickets/t1")));
    await assertFails(getDoc(doc(base(INCONNU), "tickets/t1/morceaux/0")));
    await assertFails(deleteDoc(doc(base(INCONNU), "tickets/t1/morceaux/0")));
    const db = base(COMPTE_2);
    const lot = writeBatch(db);
    for (const chemin of ["tickets/t1", "tickets/t1/morceaux/0", "tickets/t1/morceaux/1"]) lot.delete(doc(db, chemin));
    await assertSucceeds(lot.commit());
  });
});

describe("réglages", () => {
  test("le foyer peut lire et écrire ses réglages, pas les autres", async () => {
    await assertSucceeds(setDoc(doc(base(COMPTE_1), "reglages/foyer"), { lidl_plus: true }));
    await assertSucceeds(getDoc(doc(base(COMPTE_2), "reglages/foyer")));
    await assertFails(getDoc(doc(base(INCONNU), "reglages/foyer")));
  });
});
