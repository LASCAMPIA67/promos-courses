// Scénarios réels : chercher dans tous les produits, même sans promo, et les ajouter à la liste.

import { expect, test } from "@playwright/test";

import { COMPTES, creerComptes, seConnecter, viderLaBase } from "./outils.js";
import { promosExemple, servirProduits, servirPromos } from "./promos-exemple.js";

test.beforeAll(async ({ request }) => {
  await creerComptes(request);
});

test.beforeEach(async ({ request, context }) => {
  await viderLaBase(request);
  await servirPromos(context);
  await servirProduits(context);
});

const champ = (page) => page.getByLabel("Article à ajouter");
const sansPromo = (page) => page.getByRole("region", { name: "Sans promo" });
const enPromo = (page) => page.getByRole("region", { name: "En promo" });

test("un produit sans promo : trouvé avec sa photo, sa marque et sa contenance, puis ajouté", async ({ page }) => {
  await seConnecter(page, COMPTES.un);
  await champ(page).fill("maggi");
  await expect(page.locator("#etat-recherche")).toHaveText("Aucune promo · 2 sans promo");
  await expect(enPromo(page)).toBeHidden();
  const produits = sansPromo(page).locator(".produit");
  await expect(produits.locator(".produit-nom")).toHaveText(["Arôme Maggi", "Bouillon cube volaille"]);
  await expect(produits.first().locator(".produit-precisions")).toHaveText("Maggi250 ml");
  await expect(produits.first().locator(".produit-prix")).toHaveText("Prix en magasin");
  // La photo d'Open Food Facts, bien chargée ; sans photo, l'emplacement neutre.
  const photo = produits.first().locator("img.photo-produit");
  await expect.poll(() => photo.evaluate((image) => image.complete && image.naturalWidth)).toBe(256);
  await expect(produits.nth(1).locator(".photo-produit")).toHaveClass(/sans-photo/);
  await expect(sansPromo(page)).toContainText("Produits et photos : Open Food Facts");

  // + Ajouter : dans la liste, avec la photo du produit.
  await produits.first().getByRole("button", { name: "Ajouter Arôme Maggi à la liste" }).click();
  await expect(produits.first().getByRole("button", { name: "Arôme Maggi : déjà dans la liste" })).toBeVisible();
  await page.getByRole("button", { name: "Effacer" }).click();
  const ligne = page.locator("#liste-a-acheter .article").filter({ hasText: "Arôme Maggi" });
  await expect(ligne.locator("img.photo-article")).toHaveAttribute(
    "src",
    /\/off\/761\/303\/500\/0000\/front_fr\.3\.200\.jpg$/,
  );
  await expect(ligne.locator(".bouton-promos")).toHaveCount(0); // pas de promo pour lui
});

test("promo ou pas : un produit en promo n'est montré qu'en promo, les autres en dessous, avec leur prix habituel", async ({
  page,
}) => {
  await seConnecter(page, COMPTES.un);
  await champ(page).fill("lait");
  await expect(enPromo(page).locator(".promo-nom").first()).toHaveText("Lait demi-écrémé");
  // Le lait Candia est en promo : il n'est pas répété sans promo.
  await expect(sansPromo(page).locator(".produit-nom")).not.toContainText(["Lait demi-écrémé"]);

  await champ(page).fill("nutella");
  await expect(page.locator("#etat-recherche")).toHaveText("Aucune promo · 1 sans promo");
  await expect(sansPromo(page).locator(".produit-prix")).toHaveText(/^Prix habituel 6,25\u00a0€ \(vu le \S+ \S+\)$/);
});

test("un produit ajouté sans promo montre sa promo dès qu'il y en a une", async ({ page, context }) => {
  await seConnecter(page, COMPTES.un);
  await champ(page).fill("nutella");
  await sansPromo(page).getByRole("button", { name: "Ajouter Nutella à la liste" }).click();
  await page.getByRole("button", { name: "Effacer" }).click();
  const ligne = page.locator("#liste-a-acheter .article").filter({ hasText: "Nutella" });
  await expect(ligne.locator(".details")).toHaveText(/ · Prix habituel 6,25\s€$/);
  await expect(ligne.locator(".bouton-promos")).toHaveCount(0);

  // Le lendemain, le Nutella est en promo : l'étiquette « Promo » apparaît à côté de l'article.
  const promos = promosExemple();
  promos.offres.push({
    ...promos.offres[0],
    id: "nutella",
    produit: "NUTELLA",
    marque: "FERRERO",
    ean: "3017620422003",
    prix: 4.99,
    ancien_prix: 6.25,
    reduction: "-20 %",
    photo: null,
    logo: null,
    historique: null,
  });
  await context.route("**/promos-test.json", (requete) => requete.fulfill({ json: promos }));
  await page.reload();
  await expect(ligne.getByRole("button", { name: /^Voir la Promo de Nutella/ })).toContainText("-20 % en caisse");
});
