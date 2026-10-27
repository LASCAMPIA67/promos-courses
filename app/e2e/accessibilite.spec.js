// Contrôle qualité : chaque écran de l'appli est vérifié avec axe, l'outil de référence pour
// l'accessibilité (https://github.com/dequelabs/axe-core) : contrastes, noms des boutons, titres,
// champs… selon les règles WCAG 2.2 niveau AA, en mode clair et en mode sombre.

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { choisirFichier, pngExemple } from "./fichiers-exemple.js";
import { COMPTES, ajouter, creerComptes, seConnecter, viderLaBase } from "./outils.js";
import { servirPromos } from "./promos-exemple.js";

const REGLES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Sans animations (réglage « Réduire les animations ») : sinon axe peut mesurer les couleurs d'un
// écran ou d'une fenêtre en plein fondu, encore à moitié transparents.
test.use({ reducedMotion: "reduce" });

/** Les problèmes trouvés par axe, en clair : « color-contrast : .periode (2) ». */
async function problemes(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(REGLES).analyze();
  return violations.map(({ id, nodes }) => `${id} : ${nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test.beforeAll(async ({ request }) => {
  await creerComptes(request, [COMPTES.un]);
});

test.beforeEach(async ({ request, context }) => {
  await viderLaBase(request);
  await servirPromos(context);
});

for (const theme of ["light", "dark"]) {
  const mode = theme === "light" ? "clair" : "sombre";

  test(`écran de connexion, en mode ${mode}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    expect(await problemes(page)).toEqual([]);
  });

  test(`liste, promos, recherche et fenêtres, en mode ${mode}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await seConnecter(page, COMPTES.un);

    // La liste : rangée par rayon, un article ajouté depuis une promo, un autre dans le caddie.
    await page.getByLabel("Article à ajouter").fill("lait");
    await expect(page.locator("#resultats .promo").first()).toBeVisible();
    expect(await problemes(page), "recherche").toEqual([]);
    await page.getByRole("button", { name: "Ajouter Lait demi-écrémé à la liste", exact: true }).click();
    await page.getByRole("button", { name: "Effacer" }).click();
    await ajouter(page, "Pain");
    await ajouter(page, "Bananes");
    await page.getByRole("checkbox", { name: "Bananes : à acheter" }).click();
    await expect(page.locator("#liste-caddie .article")).toHaveCount(1);
    await expect(page.locator(".bouton-promos")).toHaveCount(1);
    expect(await problemes(page), "liste").toEqual([]);

    // La promo d'un article.
    await page.getByRole("button", { name: /^Voir la promo de Lait demi-écrémé/i }).click();
    await expect(page.getByRole("dialog", { name: "Promo pour « Lait demi-écrémé »" })).toBeVisible();
    expect(await problemes(page), "promo d'un article").toEqual([]);
    await page.getByRole("button", { name: "Fermer" }).click();

    // Modifier un article.
    await page.getByRole("button", { name: /^Modifier Pain/ }).click();
    await expect(page.getByRole("dialog", { name: "Modifier l'article" })).toBeVisible();
    expect(await problemes(page), "modifier un article").toEqual([]);
    await page.getByRole("button", { name: "Annuler" }).click();

    // Mon compte.
    await page.getByRole("button", { name: "Mon compte" }).click();
    await expect(page.getByRole("dialog", { name: "Mon compte" })).toBeVisible();
    expect(await problemes(page), "mon compte").toEqual([]);
    await page.getByRole("button", { name: "Fermer" }).click();

    // Les tickets de caisse : ajouter, la liste sous les courses, un ticket ouvert.
    const photo = { name: "IMG_0042.png", mimeType: "image/png", buffer: pngExemple() };
    await choisirFichier(page, page.getByRole("button", { name: "Ajouter un ticket de caisse" }), photo);
    const nouveau = page.getByRole("dialog", { name: "Nouveau ticket" });
    await expect(nouveau.getByRole("img", { name: "Aperçu du ticket" })).toBeVisible();
    expect(await problemes(page), "nouveau ticket").toEqual([]);
    await nouveau.getByLabel("Montant").fill("12,30");
    await nouveau.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("#liste-tickets .ticket")).toHaveCount(1);
    expect(await problemes(page), "tickets sous la liste").toEqual([]);
    await page.getByRole("button", { name: /^Ouvrir le ticket Leclerc · / }).click();
    await expect(page.getByRole("img", { name: "Photo du ticket de caisse" })).toBeVisible();
    expect(await problemes(page), "ticket ouvert").toEqual([]);
  });
}
