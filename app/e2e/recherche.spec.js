// Scénario réel : en écrivant un article, les promos qui correspondent s'affichent aussitôt.

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

const champ = (page) => page.getByLabel("Article à ajouter");
const noms = (page) => page.locator("#resultats .promo-nom");

test("en écrivant un article, les promos s'affichent ; on en ajoute une, ou ce qu'on a écrit", async ({ page }) => {
  await seConnecter(page, COMPTES.un);

  // Une seule lettre : rien encore.
  await champ(page).fill("l");
  await expect(page.locator("#suggestions")).toBeHidden();

  // « lait » : les promos trouvées remplacent la liste, Leclerc d'abord, le mot entier avant « Laitue ».
  await champ(page).fill("lait");
  await expect(page.locator("#etat-recherche")).toHaveText("4 promos");
  await expect(noms(page)).toHaveText([
    "Lait demi-écrémé UHT LACTEL",
    "Lait demi-écrémé MILSANI",
    "Laitue",
    "Chocolat au lait CÔTE D'OR",
  ]);
  await expect(page.locator("#contenu")).toBeHidden();

  // Ajouter une promo : le bouton le confirme.
  await page.getByRole("button", { name: "Ajouter Lait demi-écrémé à la liste" }).click();
  await expect(page.getByRole("button", { name: "Lait demi-écrémé : déjà dans la liste" })).toBeDisabled();

  // Effacer : la liste revient, avec l'article et une note courte : où, à quel prix, jusqu'à quand.
  await page.getByRole("button", { name: "Effacer" }).click();
  await expect(page.locator("#suggestions")).toBeHidden();
  await expect(aAcheter(page).locator(".nom")).toHaveText(["Lait demi-écrémé"]);
  await expect(aAcheter(page).locator(".details")).toContainText("Lidl · 0,89 € · jusqu'au");

  // Aucune promo : « OK » sur le clavier l'ajoute quand même.
  await champ(page).fill("xyz");
  await expect(page.locator("#etat-recherche")).toHaveText("Aucune promo · + pour l'ajouter");
  await champ(page).press("Enter");
  await expect(champ(page)).toHaveValue("");
  await expect(aAcheter(page).locator(".nom")).toHaveText(["Lait demi-écrémé", "xyz"]);
});

test("beaucoup de promos : on en montre 30, puis plus à la demande", async ({ page, context }) => {
  await context.unroute("**/promos-test.json");
  await servirPromos(context, { multiplier: 10 }); // 40 promos pour « lait »
  await seConnecter(page, COMPTES.un);
  await champ(page).fill("lait");
  await expect(page.locator("#etat-recherche")).toHaveText("40 promos");
  await expect(noms(page)).toHaveCount(30);
  await page.getByRole("button", { name: "Voir plus de promos" }).click();
  await expect(noms(page)).toHaveCount(40);
  await expect(page.getByRole("button", { name: "Voir plus de promos" })).toBeHidden();
});
