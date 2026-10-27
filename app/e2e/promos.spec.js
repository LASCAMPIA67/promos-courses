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

  // Le détail : les plus proches d'abord, Leclerc avant Lidl.
  await page.getByRole("button", { name: "Voir 3 promos pour Lait" }).click();
  const fenetre = page.getByRole("dialog", { name: "Promos pour « Lait »" });
  await expect(fenetre).toBeVisible();
  await expect(fenetre.locator("#resume-promos")).toHaveText("3 promos : 2 chez Leclerc, 1 chez Lidl");
  await expect(fenetre.locator(".promo-nom")).toHaveText(["Lait demi-écrémé UHT LACTEL", "Lait demi-écrémé MILSANI", "Chocolat au lait CÔTE D'OR"]);

  // Leclerc, à venir, en lot : prix à l'unité, et le prix en prenant les 2.
  const aVenir = fenetre.locator(".promo").nth(0);
  await expect(aVenir.locator(".enseigne")).toHaveText("Leclerc");
  await expect(aVenir.locator(".periode")).toContainText("À partir du");
  await expect(aVenir.locator(".promo-description")).toHaveText("6 x 1 L");
  await expect(aVenir.locator(".promo-prix")).toHaveText("6,12 €l'unité1,02 €/L");
  await expect(aVenir.locator(".avantage")).toHaveText(
    "En prenant plusieurs-50 % sur le 2e : 9,18 € les 2 (0,77 €/L), en caisse.",
  );
  await expect(aVenir.getByRole("link", { name: "Voir dans le catalogue" })).toHaveAttribute(
    "href",
    "https://exemple.test/catalogue/lait-leclerc",
  );

  // Lidl, réduction immédiate : ancien prix barré, déjà déduit en caisse.
  const lidl = fenetre.locator(".promo").nth(1);
  await expect(lidl.locator(".enseigne")).toHaveText("Lidl");
  await expect(lidl.locator(".prix")).toHaveText("0,89 €");
  await expect(lidl.locator(".ancien-prix")).toHaveText("1,05 €");
  await expect(lidl.locator(".avantage")).toHaveText("Réduction en caisse-15 %, déjà déduit du prix affiché.");
  await expect(lidl.locator(".periode")).toContainText("Jusqu'au");

  await fenetre.getByRole("button", { name: "Fermer" }).click();
  await expect(fenetre).toBeHidden();

  // Dans le caddie, plus besoin de l'étiquette.
  await page.getByRole("checkbox", { name: "Laitue : à acheter" }).click();
  await expect(caddie(page)).toContainText("Laitue");
  await expect(caddie(page).locator(".bouton-promos")).toHaveCount(0);
  await expect(page.locator("#resume")).toHaveText("2 articles à acheter · 1 en promo");
});

test("le prix dit clairement où va la réduction : carte E.Leclerc ou Lidl Plus", async ({ page, context }) => {
  await servirPromos(context);
  await seConnecter(page, COMPTES.un);
  await ajouter(page, "Pain complet");
  await ajouter(page, "Bananes");

  await page.getByRole("button", { name: "Voir 1 promo pour Pain complet" }).click();
  const pain = page.getByRole("dialog", { name: "Promos pour « Pain complet »" }).locator(".promo");
  await expect(pain.locator(".promo-prix")).toHaveText("2,35 €en caisse");
  await expect(pain.locator(".avantage")).toHaveText(
    "Sur la carte E.Leclerc0,70 € (30 %) reviennent sur la carte E.Leclerc, à dépenser plus tard : revient à 1,65 € (3,30 €/kg).",
  );
  await page.getByRole("button", { name: "Fermer" }).click();

  await page.getByRole("button", { name: "Voir 1 promo pour Bananes" }).click();
  const bananes = page.getByRole("dialog", { name: "Promos pour « Bananes »" }).locator(".promo");
  await expect(bananes.locator(".promo-prix")).toHaveText("1,29 €avec Lidl Plus");
  await expect(bananes.locator(".avantage")).toHaveText(
    "Avec l'appli Lidl PlusPrix avec l'appli Lidl Plus, à scanner en caisse (sans l'appli : 1,69 €).",
  );
});

test("« Chips » trouve aussi les marques de chips, comme Pringles", async ({ page, context }) => {
  await servirPromos(context);
  await seConnecter(page, COMPTES.un);
  await ajouter(page, "Chips");
  await page.getByRole("button", { name: "Voir 1 promo pour Chips" }).click();
  await expect(page.getByRole("dialog", { name: "Promos pour « Chips »" }).locator(".promo-nom")).toHaveText(["Pringles"]);
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
