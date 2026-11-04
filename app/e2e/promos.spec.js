// Scénarios réels : les promos dans la liste (fichier d'exemple, aux dates du jour). Seul un article
// ajouté depuis une promo (« + Ajouter ») affiche cette promo à droite.

import { expect, test } from "@playwright/test";

import { COMPTES, aAcheter, ajouter, caddie, creerComptes, ecrireArticle, seConnecter, viderLaBase } from "./outils.js";
import { servirPromos } from "./promos-exemple.js";

test.beforeAll(async ({ request }) => {
  await creerComptes(request, [COMPTES.un]);
});

test.beforeEach(async ({ request }) => {
  await viderLaBase(request);
});

/** La ligne de l'article qui porte exactement ce nom. */
const ligne = (page, nom) =>
  aAcheter(page)
    .locator(".article")
    .filter({ has: page.locator(".nom").getByText(nom, { exact: true }) });

/** Écrit dans le champ, touche « + Ajouter » sur la promo, puis efface le champ. */
async function ajouterDepuisPromo(page, recherche, nom) {
  await page.getByLabel("Article à ajouter").fill(recherche);
  await page.getByRole("button", { name: `Ajouter ${nom} à la liste`, exact: true }).click();
  await page.getByRole("button", { name: "Effacer" }).click();
  await expect(ligne(page, nom)).toBeVisible();
}

test("un article ajouté depuis une promo l'affiche à droite ; écrit à la main, rien", async ({ page, context }) => {
  await servirPromos(context);
  await seConnecter(page, COMPTES.un);
  await expect(page.locator(".pied")).toHaveText(/^\s*v\d+\.\d+\.\d+\s*$/); // en bas : la version, rien d'autre

  await ajouterDepuisPromo(page, "lait", "Lait demi-écrémé UHT");
  await ajouter(page, "Laitue"); // écrite à la main : même en promo, rien à droite
  const uht = ligne(page, "Lait demi-écrémé UHT");
  await expect(uht.locator(".type-promo")).toHaveText(/^-50 % sur le 2e · dès le \d/);
  await expect(uht.locator(".details")).toHaveText(/^\d\d:\d\d · 6,12 €$/);
  await expect(ligne(page, "Laitue")).toBeVisible();
  await expect(ligne(page, "Laitue").locator(".bouton-promos")).toHaveCount(0);
  // Dans la liste aussi, la photo du produit, en petit ; rien pour un article écrit à la main.
  const photoUht = uht.locator("img.photo-article");
  await expect(photoUht).toHaveAttribute("src", "https://exemple.test/photos/lait-uht.jpg");
  await expect.poll(() => photoUht.evaluate((image) => image.complete && image.naturalWidth)).toBe(256);
  await expect(ligne(page, "Laitue").locator(".photo-article")).toHaveCount(0);
  // La toucher montre la promo.
  await photoUht.click();
  await expect(page.getByRole("dialog", { name: "Promo pour « Lait demi-écrémé UHT »" })).toBeVisible();
  await page.getByRole("button", { name: "Fermer" }).click();

  // Le détail de cette promo-là, et d'elle seule.
  await uht.getByRole("button", { name: /^Voir la promo de Lait demi-écrémé UHT/i }).click();
  const fenetre = page.getByRole("dialog", { name: "Promo pour « Lait demi-écrémé UHT »" });
  const promo = fenetre.locator(".promo");
  await expect(promo).toHaveCount(1);
  await expect(promo.locator(".periode")).toContainText("Dès");
  await expect(promo.locator(".promo-nom")).toHaveText("Lait demi-écrémé UHT");
  await expect(promo.getByRole("img", { name: "LACTEL" })).toHaveClass("logo-marque"); // en haut à droite
  await expect(promo.locator(".promo-description")).toHaveText("6 x 1 L");
  await expect(promo.locator(".promo-prix")).toHaveText("6,12 €1,02 €/L");
  await expect(promo.locator(".promo-bas")).toHaveText("-50 % sur le 2e9,18 € les 2 (0,77 €/L)");
  await expect(promo.getByRole("link", { name: "Voir Lait demi-écrémé UHT dans le catalogue" })).toHaveAttribute(
    "href",
    "https://exemple.test/catalogue/lait-leclerc",
  );
  await fenetre.getByRole("button", { name: "Fermer" }).click();
  await expect(fenetre).toBeHidden();

  // Réduction immédiate : ancien prix barré.
  await ajouterDepuisPromo(page, "lait", "Lait demi-écrémé");
  await expect(ligne(page, "Lait demi-écrémé").locator(".type-promo")).toHaveText("-15 % en caisse");
  await ligne(page, "Lait demi-écrémé")
    .getByRole("button", { name: /^Voir la promo/i })
    .click();
  const lait = page.getByRole("dialog", { name: "Promo pour « Lait demi-écrémé »" }).locator(".promo");
  await expect(lait.locator(".prix")).toHaveText("0,89 €");
  await expect(lait.locator(".ancien-prix")).toHaveText("1,05 €");
  await expect(lait.locator(".type")).toHaveText("-15 % en caisse");
  await expect(lait.locator(".periode")).toContainText("Jusqu'au");
  await page.getByRole("button", { name: "Fermer" }).click();

  // Dans le caddie, plus besoin de l'étiquette.
  await page.getByRole("checkbox", { name: "Lait demi-écrémé : à acheter" }).click();
  await expect(caddie(page)).toContainText("Lait demi-écrémé");
  await expect(caddie(page).locator(".bouton-promos")).toHaveCount(0);
  await expect(caddie(page).locator(".photo-article")).toHaveCount(0);
});

test("le prix dit clairement où va la réduction : sur la carte E.Leclerc, ou en caisse avec la carte", async ({
  page,
  context,
}) => {
  await servirPromos(context);
  await seConnecter(page, COMPTES.un);
  await ajouterDepuisPromo(page, "pain", "Pain de mie complet");
  await ajouterDepuisPromo(page, "bananes", "Bananes");
  await expect(ligne(page, "Pain de mie complet").locator(".type-promo")).toHaveText("30 % sur la carte");
  await expect(ligne(page, "Bananes").locator(".type-promo")).toHaveText("-23 % avec la carte");

  await ligne(page, "Pain de mie complet")
    .getByRole("button", { name: /^Voir la promo/i })
    .click();
  const pain = page.getByRole("dialog", { name: "Promo pour « Pain de mie complet »" }).locator(".promo");
  await expect(pain.locator(".promo-prix")).toHaveText("2,35 €");
  await expect(pain.locator(".type")).toHaveText("30 % sur la carte");
  await expect(pain.locator(".detail")).toHaveText("revient à 1,65 € (3,30 €/kg)");
  await page.getByRole("button", { name: "Fermer" }).click();

  await ligne(page, "Bananes")
    .getByRole("button", { name: /^Voir la promo/i })
    .click();
  const bananes = page.getByRole("dialog", { name: "Promo pour « Bananes »" }).locator(".promo");
  await expect(bananes.locator(".prix")).toHaveText("1,29 €");
  await expect(bananes.locator(".ancien-prix")).toHaveText("1,69 €");
  await expect(bananes.locator(".type")).toHaveText("-23 % avec la carte");
});

test("une même promo « au choix » (plusieurs parfums) n'est montrée qu'une fois", async ({ page, context }) => {
  await servirPromos(context);
  await seConnecter(page, COMPTES.un);
  await page.getByLabel("Article à ajouter").fill("shampoing");
  const resultats = page.locator("#resultats .promo");
  await expect(resultats).toHaveCount(1);
  await expect(resultats.locator(".promo-nom")).toHaveText("Shampooing");
  // Son logo est introuvable : son nom, en petit, à la place.
  await expect(resultats.locator(".marque-promo")).toHaveText("LE PETIT MARSEILLAIS");
  await expect(resultats.locator(".logo-marque")).toHaveCount(0);
  await expect(resultats.locator(".promo-description")).toHaveText(
    "Au choix : Douceur & Éclat, Nutrition, Purifiant · 2 x 300 ml (600 ml)",
  );
  await page.getByRole("button", { name: "Ajouter Shampooing à la liste" }).click();
  await page.getByRole("button", { name: "Effacer" }).click();
  await expect(ligne(page, "Shampooing").locator(".type-promo")).toHaveText("-40 % en caisse");
});

test("« Chips » trouve aussi les marques de chips, comme Pringles", async ({ page, context }) => {
  await servirPromos(context);
  await seConnecter(page, COMPTES.un);
  await page.getByLabel("Article à ajouter").fill("chips");
  await expect(page.locator("#resultats .promo-nom")).toHaveText(["Pringles"]);
});

test("chaque promo montre la photo de son produit et, dans le coin, le logo de sa marque", async ({
  page,
  context,
}) => {
  await servirPromos(context);
  await seConnecter(page, COMPTES.un);
  await page.getByLabel("Article à ajouter").fill("lait");
  const promos = page.locator("#resultats .promo");
  // Le nom seul : la marque est dans le coin.
  await expect(promos.locator(".promo-nom")).toHaveText([
    "Lait demi-écrémé",
    "Lait demi-écrémé UHT",
    "Laitue",
    "Chocolat au lait",
  ]);
  // Le logo de la marque (vignette du robot), bien chargé ; sans logo sûr, le nom de la marque en petit.
  const logo = promos.first().getByRole("img", { name: "CANDIA" });
  await expect(logo).toHaveAttribute("src", "https://exemple.test/logos/candia.png");
  await expect.poll(() => logo.evaluate((image) => image.complete && image.naturalWidth)).toBe(240);
  await expect(promos.nth(3).locator(".marque-promo")).toHaveText("CÔTE D'OR");
  await expect(promos.nth(2).locator(".marque-promo, .logo-marque")).toHaveCount(0); // pas de marque
  // La vignette du robot, bien chargée.
  const photo = promos.first().locator("img.photo-promo");
  await expect(photo).toHaveAttribute("src", "https://exemple.test/photos/lait.jpg");
  await expect.poll(() => photo.evaluate((image) => image.complete && image.naturalWidth)).toBe(256);
  // Pas de photo sûre (produit frais) : un emplacement neutre, jamais une photo au hasard.
  await expect(promos.nth(2).locator(".photo-promo")).toHaveClass(/sans-photo/);
  await expect(promos.nth(2).locator("img")).toHaveCount(0);

  // L'historique des prix : seulement pour les produits déjà vus en promo.
  await expect(promos.first().locator(".historique-prix")).toHaveText(/^Prix le plus bas vu depuis le \S+ \S+$/);
  await expect(promos.nth(1).locator(".historique-prix")).toHaveText(
    /^Déjà vu moins cher : 4,29\u00a0€ l'article, le \S+ \S+$/,
  );
  await expect(promos.nth(2).locator(".historique-prix")).toHaveCount(0);

  // Un produit Marque Repère : le logo Marque Repère ; VoiceOver lit aussi le nom de la gamme.
  await page.getByLabel("Article à ajouter").fill("jambon");
  await expect(promos.locator(".promo-nom")).toHaveText(["Jambon cuit supérieur"]);
  await expect(promos.getByRole("img", { name: "Marque Repère (TRADILÈGE)" })).toHaveAttribute(
    "src",
    "https://exemple.test/logos/marque-repere.png",
  );

  // Une photo introuvable : l'emplacement neutre aussi, pas d'image cassée.
  await page.getByLabel("Article à ajouter").fill("bananes");
  await expect(promos.locator(".promo-nom")).toHaveText(["Bananes"]);
  await expect(promos.locator(".photo-promo")).toHaveClass(/sans-photo/);
  await expect(promos.locator("img")).toHaveCount(0);
});

test("articles des versions précédentes : promo retrouvée d'après la note, ou dite terminée", async ({
  page,
  context,
  request,
}) => {
  await servirPromos(context);
  // Ajoutés depuis une promo par une ancienne version : pas d'identifiant, une note « Promo Leclerc : … ».
  await ecrireArticle(request, "ancien-lait", {
    nom: "Lait demi-écrémé",
    note: "Promo Leclerc : 0,89 € · Jusqu'au samedi 31 octobre",
  });
  // Une promo choisie qui n'est plus dans les catalogues.
  await ecrireArticle(request, "ancien-beurre", { nom: "Beurre doux", note: "Leclerc · 1,99 €", promo: "beurre" });
  await seConnecter(page, COMPTES.un);
  await expect(ligne(page, "Lait demi-écrémé").locator(".type-promo")).toHaveText("-15 % en caisse");
  await expect(ligne(page, "Lait demi-écrémé").locator(".details")).toHaveText(/^\d\d:\d\d · 0,89 €$/);
  await expect(ligne(page, "Beurre doux").locator(".promo-terminee")).toHaveText("Promo terminée");
  await expect(ligne(page, "Beurre doux").locator(".bouton-promos")).toHaveCount(0);
});

test("des promos trop anciennes ou incomplètes sont signalées", async ({ page, context }) => {
  const ilYATroisJours = new Date(Date.now() - 3 * 24 * 3_600_000);
  await servirPromos(context, { miseAJour: ilYATroisJours, etatLeclerc: "erreur" });
  await seConnecter(page, COMPTES.un);
  const etat = page.locator("#etat-promos");
  await expect(etat).toContainText("Promos du");
  await expect(etat).toContainText("elles ont pu changer");
  await expect(etat).toContainText("Promos E.Leclerc Geispolsheim pas à jour.");
});

test("sans promos, la liste marche quand même", async ({ page, context }) => {
  await context.route("**/promos-test.json", (requete) => requete.abort("internetdisconnected"));
  await seConnecter(page, COMPTES.un);
  await expect(page.locator("#etat-promos")).toHaveText("Promos indisponibles (pas de réseau ?).");
  await ajouter(page, "Lait");
  await expect(aAcheter(page)).toContainText("Lait");

  // Les promos reviennent avec le réseau.
  await context.unroute("**/promos-test.json");
  await servirPromos(context);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("#etat-promos")).toBeHidden();
  await page.getByLabel("Article à ajouter").fill("lait");
  await expect(page.locator("#etat-recherche")).toHaveText("4 promos");
});
