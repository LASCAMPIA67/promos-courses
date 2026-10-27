// Scénarios réels sur l'émulateur Firebase, avec les mêmes règles d'accès que la vraie base.

import { expect, test } from "@playwright/test";

import { COMPTES, aAcheter, ajouter, caddie, creerComptes, seConnecter, viderLaBase } from "./outils.js";

test.beforeAll(async ({ request }) => {
  await creerComptes(request);
});

test.beforeEach(async ({ request }) => {
  await viderLaBase(request);
});

test("un mauvais mot de passe est refusé avec un message clair", async ({ page }) => {
  await page.goto("");
  await page.getByLabel("E-mail").fill(COMPTES.un.email);
  await page.getByLabel("Mot de passe").fill("pas-le-bon");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("alert")).toHaveText("E-mail ou mot de passe incorrect.");
});

test("ajouter, cocher, modifier et supprimer des articles", async ({ page }) => {
  await seConnecter(page, COMPTES.un);
  await expect(page.getByText("La liste est vide")).toBeVisible();

  await ajouter(page, "Lait demi-écrémé", "2 L");
  await ajouter(page, "Pain");
  await expect(aAcheter(page).locator(".nom")).toHaveText(["Lait demi-écrémé", "Pain"]);
  await expect(aAcheter(page)).toContainText("2 L");
  await expect(page.locator("#resume")).toHaveText("2 articles à acheter");

  // Un doublon est signalé au lieu d'être ajouté.
  await ajouter(page, "lait demi ecreme");
  await expect(page.locator("#message-ajout")).toHaveText("« Lait demi-écrémé » est déjà dans la liste.");
  await expect(aAcheter(page).locator(".article")).toHaveCount(2);

  // Cocher : l'article passe dans le caddie.
  await page.getByRole("checkbox", { name: "Pain : à acheter" }).click();
  await expect(caddie(page).locator(".nom")).toHaveText(["Pain"]);
  await expect(page.getByRole("heading", { name: "Dans le caddie (1)" })).toBeVisible();

  // Modifier : nom, quantité et note.
  await page.getByRole("button", { name: "Modifier Lait demi-écrémé" }).click();
  const fenetre = page.getByRole("dialog", { name: "Modifier l'article" });
  await fenetre.getByLabel("Nom").fill("Lait entier");
  await fenetre.getByLabel("Quantité").fill("1 L");
  await fenetre.getByLabel("Note").fill("bio si possible");
  await fenetre.getByRole("button", { name: "Enregistrer" }).click();
  await expect(aAcheter(page)).toContainText("Lait entier");
  await expect(aAcheter(page)).toContainText("1 L · bio si possible");

  // Supprimer, avec confirmation.
  await page.getByRole("button", { name: "Modifier Lait entier" }).click();
  await page.getByRole("button", { name: "Supprimer l'article" }).click();
  await expect(page.getByText("Supprimer « Lait entier » de la liste ?")).toBeVisible();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("La liste est vide")).toBeVisible();

  // Vider le caddie.
  await page.getByRole("button", { name: "Tout retirer" }).click();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.locator("#section-caddie")).toBeHidden();
});

test("les deux téléphones voient les changements de l'autre en direct", async ({ browser }) => {
  const telephone1 = await (await browser.newContext()).newPage();
  const telephone2 = await (await browser.newContext()).newPage();
  await seConnecter(telephone1, COMPTES.un);
  await seConnecter(telephone2, COMPTES.deux);

  await ajouter(telephone1, "Beurre doux");
  await expect(aAcheter(telephone2)).toContainText("Beurre doux");

  await telephone2.getByRole("checkbox", { name: "Beurre doux : à acheter" }).click();
  await expect(caddie(telephone1)).toContainText("Beurre doux");

  await telephone1.context().close();
  await telephone2.context().close();
});

test("sans réseau, l'appli continue de marcher et envoie tout au retour du réseau", async ({ browser }) => {
  const telephone1 = await (await browser.newContext()).newPage();
  const telephone2 = await (await browser.newContext()).newPage();
  await seConnecter(telephone1, COMPTES.un);
  await seConnecter(telephone2, COMPTES.deux);

  await telephone1.context().setOffline(true);
  await expect(telephone1.getByRole("status").filter({ hasText: "Hors connexion" })).toBeVisible();
  await ajouter(telephone1, "Œufs", "12");
  await expect(aAcheter(telephone1)).toContainText("Œufs");

  await telephone1.context().setOffline(false);
  await expect(aAcheter(telephone2)).toContainText("Œufs");
  await expect(telephone1.getByText("Hors connexion")).toBeHidden();

  await telephone1.context().close();
  await telephone2.context().close();
});

test("un autre compte Firebase n'a pas accès à la liste", async ({ page }) => {
  await seConnecter(page, COMPTES.intrus);
  await expect(page.locator("#bandeau")).toHaveText("Ce compte n'a pas accès à la liste de courses.");
});

test("se déconnecter ramène à l'écran de connexion", async ({ page }) => {
  await seConnecter(page, COMPTES.deux);
  await page.getByRole("button", { name: "Mon compte" }).click();
  await expect(page.getByText(COMPTES.deux.email)).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
});
