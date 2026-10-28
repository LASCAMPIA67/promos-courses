// Scénarios réels : chercher dans tous les produits, en promo ou non, en une seule liste ; un mot mal
// écrit trouve les produits qui y ressemblent ; on les ajoute à la liste.

import { expect, test } from "@playwright/test";

import { COMPTES, creerComptes, seConnecter, viderLaBase } from "./outils.js";
import { VIGNETTE_LAIT_ENTIER, promosExemple, servirProduits, servirPromos } from "./promos-exemple.js";

test.beforeAll(async ({ request }) => {
  await creerComptes(request);
});

test.beforeEach(async ({ request, context }) => {
  await viderLaBase(request);
  await servirPromos(context);
  await servirProduits(context);
});

const champ = (page) => page.getByLabel("Article à ajouter");
const fiches = (page) => page.locator("#resultats .promo");
const fiche = (page, nom) => fiches(page).filter({ has: page.locator(".promo-nom", { hasText: nom }) });
const chargee = (image) => image.evaluate((i) => i.complete && i.naturalWidth);

test("un produit sans promo : sa fiche, comme celle d'une promo, sans la promo ; puis ajouté", async ({ page }) => {
  await seConnecter(page, COMPTES.un);
  await champ(page).fill("maggi");
  await expect(page.locator("#etat-recherche")).toHaveText("2 produits");
  await expect(fiches(page).locator(".promo-nom")).toHaveText(["Arôme Maggi", "Bouillon cube volaille"]);
  const arome = fiches(page).first();
  await expect(arome.locator(".promo-description")).toHaveText("250 ml");
  // Pas de promo : ni dates, ni prix, ni type de promo.
  await expect(arome.locator(".periode, .promo-prix, .type")).toHaveCount(0);
  // Le logo de la marque, déjà vu dans un catalogue Leclerc (vignettes.json), dans le coin.
  await expect(arome.getByRole("img", { name: "Maggi" })).toHaveClass(/logo-marque/);
  // La photo d'Open Food Facts, bien chargée ; sans photo, l'emplacement neutre.
  await expect.poll(() => chargee(arome.locator("img.photo-promo"))).toBe(256);
  await expect(fiches(page).nth(1).locator(".photo-promo")).toHaveClass(/sans-photo/);
  await expect(page.locator("#credit-produits")).toContainText("Produits et photos : Open Food Facts");

  // + Ajouter : dans la liste, avec la photo du produit.
  await arome.getByRole("button", { name: "Ajouter Arôme Maggi à la liste" }).click();
  await expect(arome.getByRole("button", { name: "Arôme Maggi : déjà dans la liste" })).toBeVisible();
  await page.getByRole("button", { name: "Effacer" }).click();
  const ligne = page.locator("#liste-a-acheter .article").filter({ hasText: "Arôme Maggi" });
  await expect(ligne.locator("img.photo-article")).toHaveAttribute(
    "src",
    /\/off\/761\/303\/500\/0000\/front_fr\.3\.200\.jpg$/,
  );
  await expect(ligne.locator(".bouton-promos")).toHaveCount(0); // pas de promo pour lui
});

test("une seule liste : les produits en promo avec leur promo, les autres sans, les plus proches d'abord", async ({
  page,
}) => {
  await seConnecter(page, COMPTES.un);
  await champ(page).fill("lait");
  await expect(page.locator("#etat-recherche")).toHaveText("5 produits, dont 4 en promo");
  // Le lait Candia est en promo : une seule fiche, avec sa promo.
  await expect(fiches(page).locator(".promo-nom")).toHaveText([
    "Lait demi-écrémé",
    "Lait demi-écrémé UHT",
    "Lait entier bio",
    "Laitue",
    "Chocolat au lait",
  ]);
  await expect(fiche(page, /^Lait demi-écrémé$/).locator(".type")).toBeVisible();
  // Le lait entier bio, sans promo : son prix habituel, et la photo du catalogue Leclerc.
  const laitEntier = fiche(page, "Lait entier bio");
  await expect(laitEntier.locator(".type, .promo-prix")).toHaveCount(0);
  await expect(laitEntier.locator(".prix-habituel")).toHaveText(/^Prix habituel 1,29\u00a0€ \(vu le \S+ \S+\)$/);
  await expect(laitEntier.locator("img.photo-promo")).toHaveAttribute("src", new RegExp(`${VIGNETTE_LAIT_ENTIER}$`));
  await expect.poll(() => chargee(laitEntier.locator("img.photo-promo"))).toBe(256);

  // Un produit d'Open Beauty Facts, avec sa photo.
  await champ(page).fill("dentifrice");
  await expect(page.locator("#etat-recherche")).toHaveText("1 produit");
  await expect(fiches(page).locator("img.photo-promo")).toHaveAttribute("src", /^https:\/\/exemple\.test\/obf\//);
});

test("un mot mal écrit : les produits qui y ressemblent, pour choisir le bon", async ({ page }) => {
  await seConnecter(page, COMPTES.un);
  await champ(page).fill("arome magi");
  await expect(page.locator("#etat-recherche")).toHaveText("Rien pour « arome magi » · 1 produit qui ressemble");
  await expect(fiches(page).locator(".promo-nom")).toHaveText(["Arôme Maggi"]);

  await champ(page).fill("nutela");
  await expect(page.locator("#etat-recherche")).toHaveText("Rien pour « nutela » · 1 produit qui ressemble");
  await fiche(page, "Nutella").getByRole("button", { name: "Ajouter Nutella à la liste" }).click();
  await page.getByRole("button", { name: "Effacer" }).click();
  await expect(page.locator("#liste-a-acheter .article .nom")).toHaveText(["Nutella"]);
});

test("un produit ajouté sans promo montre sa promo dès qu'il y en a une", async ({ page, context }) => {
  await seConnecter(page, COMPTES.un);
  await champ(page).fill("nutella");
  await expect(page.locator("#etat-recherche")).toHaveText("1 produit");
  await expect(fiches(page).locator(".prix-habituel")).toHaveText(/^Prix habituel 6,25\u00a0€ \(vu le \S+ \S+\)$/);
  await fiches(page).getByRole("button", { name: "Ajouter Nutella à la liste" }).click();
  await page.getByRole("button", { name: "Effacer" }).click();
  const ligne = page.locator("#liste-a-acheter .article").filter({ hasText: "Nutella" });
  await expect(ligne.locator(".details")).toHaveText(/ · Prix habituel 6,25\s€$/);
  await expect(ligne.locator(".bouton-promos")).toHaveCount(0);

  // Le lendemain, le Nutella est en promo : l'étiquette « Promo » apparaît à côté de l'article,
  // et dans la recherche, sa fiche montre sa promo.
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
  await champ(page).fill("nutella");
  await expect(page.locator("#etat-recherche")).toHaveText("1 produit en promo");
  await expect(fiches(page).locator(".type")).toHaveText("-20 % en caisse");
});
