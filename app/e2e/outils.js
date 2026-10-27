// Outils communs aux scénarios réels : comptes de test et gestes de base dans l'appli.

import { expect } from "@playwright/test";

const PROJET = "demo-promos-courses";
const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = "http://127.0.0.1:8080";

// Les deux premiers comptes ont les identifiants autorisés par firebase/firestore.rules.
export const COMPTES = {
  un: { uid: "ElRK8CEajUMQmtajHXv5qZVVT6G2", email: "compte1@exemple.test", motDePasse: "motdepasse-1" },
  deux: { uid: "XABqepPEkHXg8gBon5ljE5XEXOD3", email: "compte2@exemple.test", motDePasse: "motdepasse-2" },
  intrus: { uid: "un-autre-compte", email: "intrus@exemple.test", motDePasse: "motdepasse-3" },
};

/** Recrée les comptes dans l'émulateur d'authentification. */
export async function creerComptes(request, comptes = Object.values(COMPTES)) {
  await request.delete(`${AUTH}/emulator/v1/projects/${PROJET}/accounts`);
  for (const compte of comptes) {
    const reponse = await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJET}/accounts`, {
      headers: { Authorization: "Bearer owner" },
      data: { localId: compte.uid, email: compte.email, password: compte.motDePasse },
    });
    expect(reponse.ok()).toBeTruthy();
  }
}

/** Vide la liste de courses de l'émulateur. */
export async function viderLaBase(request) {
  await request.delete(`${FIRESTORE}/emulator/v1/projects/${PROJET}/databases/(default)/documents`);
}

export async function seConnecter(page, compte) {
  await page.goto("");
  await page.getByLabel("E-mail").fill(compte.email);
  await page.getByLabel("Mot de passe").fill(compte.motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Liste de courses" })).toBeVisible();
}

export async function ajouter(page, nom, quantite = "") {
  const formulaire = page.locator("#form-ajout");
  await formulaire.getByLabel("Article à ajouter").fill(nom);
  await formulaire.getByLabel("Quantité (facultatif)").fill(quantite);
  await formulaire.getByRole("button", { name: "Ajouter l'article" }).click();
}

export const aAcheter = (page) => page.locator("#liste-a-acheter");
export const caddie = (page) => page.locator("#liste-caddie");

/**
 * Écrit un article directement dans l'émulateur, comme l'aurait fait une ancienne version de l'appli
 * (les règles d'accès ne s'appliquent pas à cette écriture d'administration).
 */
export async function ecrireArticle(request, id, { nom, note, promo, ajoutePar = COMPTES.un.uid }) {
  const texte = (valeur) => (valeur == null ? {} : { stringValue: valeur });
  const maintenant = { timestampValue: new Date().toISOString() };
  const champs = {
    nom: texte(nom),
    achete: { booleanValue: false },
    ajoute_par: texte(ajoutePar),
    cree_le: maintenant,
    modifie_le: maintenant,
    ...(note ? { note: texte(note) } : {}),
    ...(promo ? { promo: texte(promo) } : {}),
  };
  const reponse = await request.patch(
    `${FIRESTORE}/v1/projects/${PROJET}/databases/(default)/documents/articles/${id}`,
    {
      headers: { Authorization: "Bearer owner" },
      data: { fields: champs },
    },
  );
  expect(reponse.ok()).toBeTruthy();
}
