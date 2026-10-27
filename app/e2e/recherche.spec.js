// Scénario réel : l'onglet « Promos », pour chercher dans toutes les promos et les ajouter à la liste.

import { expect, test } from "@playwright/test";

import { COMPTES, aAcheter, creerComptes, seConnecter, viderLaBase } from "./outils.js";
import { servirPromos } from "./promos-exemple.js";

test.beforeAll(async ({ request }) => {
  await creerComptes(request, [COMPTES.un]);
});

test.beforeEach(async ({ request, context }) => {
  await viderLaBase(request);
  await servirPromos(context);
});

const onglet = (page, nom) => page.getByRole("navigation").getByRole("button", { name: nom, exact: true });
const noms = (page) => page.locator("#resultats .promo-nom");

test("chercher une promo, filtrer par magasin et l'ajouter à la liste", async ({ page }) => {
  await seConnecter(page, COMPTES.un);
  await onglet(page, "Promos").click();
  await expect(page.getByRole("heading", { name: "Promos", exact: true })).toBeVisible();
  await expect(onglet(page, "Promos")).toHaveAttribute("aria-current", "page");

  // Sans rien chercher : toutes les promos en cours et à venir (la promo terminée n'y est pas).
  await expect(page.locator("#etat-recherche")).toHaveText("8 promos en cours et à venir.");
  await expect(noms(page)).toHaveCount(8);

  // Pendant qu'on tape : le mot entier d'abord, puis les mots qui commencent pareil.
  await page.getByRole("searchbox", { name: "Chercher une promo" }).fill("lait");
  await expect(page.locator("#etat-recherche")).toHaveText("4 promos trouvées.");
  await expect(noms(page)).toHaveText(["Lait demi-écrémé", "Lait demi-écrémé UHT", "Laitue", "Chocolat au lait"]);

  await page.getByRole("button", { name: "Lidl", exact: true }).click();
  await expect(noms(page)).toHaveText(["Lait demi-écrémé", "Laitue"]);
  await expect(page.locator("#etat-recherche")).toHaveText("2 promos trouvées chez Lidl.");

  // Ajouter à la liste : le bouton le confirme.
  await page.getByRole("button", { name: "Ajouter Lait demi-écrémé à la liste" }).click();
  await expect(page.getByRole("button", { name: "Lait demi-écrémé : déjà dans la liste" })).toBeDisabled();

  await page.getByRole("searchbox", { name: "Chercher une promo" }).fill("xyz");
  await expect(page.locator("#etat-recherche")).toHaveText("Aucune promo pour « xyz » chez Lidl.");

  // Dans la liste : l'article, avec une note qui rappelle où et à quel prix, et son étiquette promo.
  await onglet(page, "Liste").click();
  await expect(aAcheter(page).locator(".nom")).toHaveText(["Lait demi-écrémé"]);
  await expect(aAcheter(page).locator(".details")).toContainText("Promo Lidl : 0,89 € · Jusqu'au");
  await expect(page.getByRole("button", { name: "Voir 2 promos pour Lait demi-écrémé" })).toBeVisible();
});

test("beaucoup de promos : on en montre 30, puis plus à la demande", async ({ page, context }) => {
  await context.unroute("**/promos-test.json");
  await servirPromos(context, { multiplier: 5 }); // 45 promos, dont 40 en cours ou à venir
  await seConnecter(page, COMPTES.un);
  await onglet(page, "Promos").click();
  await expect(page.locator("#etat-recherche")).toHaveText("40 promos en cours et à venir.");
  await expect(noms(page)).toHaveCount(30);
  await page.getByRole("button", { name: "Voir plus de promos" }).click();
  await expect(noms(page)).toHaveCount(40);
  await expect(page.getByRole("button", { name: "Voir plus de promos" })).toBeHidden();
});
