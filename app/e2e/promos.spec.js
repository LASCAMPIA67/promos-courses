// Scénarios réels : la liste de courses comparée aux promos (fichier d'exemple, aux dates du jour).

import { expect, test } from "@playwright/test";

import { COMPTES, aAcheter, ajouter, caddie, creerComptes, seConnecter, viderLaBase } from "./outils.js";
import { servirPromos } from "./promos-exemple.js";

test.beforeAll(async ({ request }) => {
  await creerComptes(request, [COMPTES.un]);
});

test.beforeEach(async ({ request }) => {
  await viderLaBase(request);
});

const ligne = (page, nom) => aAcheter(page).locator(".article").filter({ hasText: nom });

test("les articles en promo sont signalés, avec le détail de chaque promo", async ({ page, context }) => {
  await servirPromos(context);
  await seConnecter(page, COMPTES.un);
  await expect(page.locator("#info-promos")).toContainText("Promos Lidl et Leclerc lues par le robot aujourd'hui");

  await ajouter(page, "Lait");
  await ajouter(page, "Beurre"); // sa promo est terminée
  await ajouter(page, "Laitue");
  await expect(ligne(page, "Lait").first().getByRole("button", { name: "Voir 3 promos pour Lait" })).toBeVisible();
  await expect(ligne(page, "Beurre").locator(".bouton-promos")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Voir 1 promo pour Laitue" })).toBeVisible();
  await expect(page.locator("#resume")).toHaveText("3 articles à acheter · 2 en promo");

  // Le détail : les plus proches d'abord, en cours avant à venir.
  await page.getByRole("button", { name: "Voir 3 promos pour Lait" }).click();
  const fenetre = page.getByRole("dialog", { name: "Promos pour « Lait »" });
  await expect(fenetre).toBeVisible();
  await expect(fenetre.locator("#resume-promos")).toHaveText("3 promos : 1 chez Lidl, 2 chez Leclerc");
  await expect(fenetre.locator(".promo-nom")).toHaveText(["Lait demi-écrémé", "Lait demi-écrémé UHT", "Chocolat au lait"]);

  const lidl = fenetre.locator(".promo").nth(0);
  await expect(lidl.locator(".enseigne")).toHaveText("Lidl");
  await expect(lidl.locator(".prix")).toHaveText("0,89 €");
  await expect(lidl.locator(".ancien-prix")).toHaveText("1,05 €");
  await expect(lidl.locator(".reduction")).toHaveText("-15 %");
  await expect(lidl.locator(".periode")).toContainText("Jusqu'au");

  const aVenir = fenetre.locator(".promo").nth(1);
  await expect(aVenir.locator(".enseigne")).toHaveText("Leclerc");
  await expect(aVenir.locator(".periode")).toContainText("À partir du");
  await expect(aVenir.locator(".promo-infos")).toHaveText("1,02 €/L · Par 2 : 9,18 € (0,77 €/L)");
  await expect(aVenir.getByRole("link", { name: "Voir dans le catalogue" })).toHaveAttribute(
    "href",
    "https://exemple.test/catalogue/lait-leclerc",
  );

  await fenetre.getByRole("button", { name: "Fermer" }).click();
  await expect(fenetre).toBeHidden();

  // Dans le caddie, plus besoin de l'étiquette.
  await page.getByRole("checkbox", { name: "Laitue : à acheter" }).click();
  await expect(caddie(page)).toContainText("Laitue");
  await expect(caddie(page).locator(".bouton-promos")).toHaveCount(0);
  await expect(page.locator("#resume")).toHaveText("2 articles à acheter · 1 en promo");
});

test("des promos trop anciennes ou incomplètes sont signalées", async ({ page, context }) => {
  const ilYATroisJours = new Date(Date.now() - 3 * 24 * 3_600_000);
  await servirPromos(context, { miseAJour: ilYATroisJours, etatLeclerc: "erreur" });
  await seConnecter(page, COMPTES.un);
  const etat = page.locator("#etat-promos");
  await expect(etat).toContainText("Les promos datent du");
  await expect(etat).toContainText("elles ont pu changer");
  await expect(etat).toContainText("Les promos d'E.Leclerc Geispolsheim n'ont pas pu être mises à jour");
});

test("sans promos, la liste marche quand même", async ({ page, context }) => {
  await context.route("**/promos-test.json", (requete) => requete.abort("internetdisconnected"));
  await seConnecter(page, COMPTES.un);
  await expect(page.locator("#etat-promos")).toHaveText(
    "Promos indisponibles pour le moment (pas de réseau ?). La liste, elle, marche normalement.",
  );
  await ajouter(page, "Lait");
  await expect(aAcheter(page)).toContainText("Lait");
  await expect(page.locator(".bouton-promos")).toHaveCount(0);

  // Les promos reviennent avec le réseau.
  await context.unroute("**/promos-test.json");
  await servirPromos(context);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("button", { name: "Voir 3 promos pour Lait" })).toBeVisible();
  await expect(page.locator("#etat-promos")).toBeHidden();
});
