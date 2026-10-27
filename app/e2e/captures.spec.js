// Captures d'écran de l'appli pour la documentation (docs/captures/).
// Lancement : npm run captures

import { expect, test } from "@playwright/test";

import { COMPTES, creerComptes, seConnecter, viderLaBase } from "./outils.js";
import { servirPromos } from "./promos-exemple.js";

const COMPTE = COMPTES.un;
const AUTRE = COMPTES.deux;
const DOSSIER = new URL("../../docs/captures/", import.meta.url).pathname;

test.skip(!process.env.CAPTURES, "captures seulement à la demande (CAPTURES=1)");
test.use({ deviceScaleFactor: 2 });

test.beforeAll(async ({ request }) => {
  await creerComptes(request, [COMPTE, AUTRE]);
  await viderLaBase(request);
});

/** Donne un prénom (fictif) et une couleur au compte connecté sur cette page. */
async function choisirFiche(page, prenom, couleur) {
  await page.getByRole("button", { name: "Mon compte" }).click();
  const fenetre = page.getByRole("dialog", { name: "Mon compte" });
  await fenetre.getByLabel("Prénom").fill(prenom);
  await fenetre.getByRole("radio", { name: couleur }).check();
  return fenetre;
}

for (const theme of ["light", "dark"]) {
  test(`captures en mode ${theme === "light" ? "clair" : "sombre"}`, async ({ page, context }) => {
    await servirPromos(context);
    await page.emulateMedia({ colorScheme: theme });
    const suffixe = theme === "light" ? "" : "-sombre";
    await page.goto("");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    await page.screenshot({ path: `${DOSSIER}connexion${suffixe}.png` });

    await page.getByLabel("E-mail").fill(COMPTE.email);
    await page.getByLabel("Mot de passe").fill(COMPTE.motDePasse);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Liste de courses" })).toBeVisible();

    if (theme === "light") {
      // Deux personnes, deux couleurs : une partie des articles est ajoutée depuis l'autre compte.
      const autre = await (await page.context().browser().newContext({ baseURL: test.info().project.use.baseURL })).newPage();
      await servirPromos(autre.context());
      await seConnecter(autre, AUTRE);
      await (await choisirFiche(autre, "Alex", "Orange")).getByRole("button", { name: "Enregistrer" }).click();
      const fenetre = await choisirFiche(page, "Camille", "Vert");
      await expect(page.locator("#legende-membres")).toContainText("Alex");
      await page.screenshot({ path: `${DOSSIER}compte.png` });
      await fenetre.getByRole("button", { name: "Enregistrer" }).click();

      for (const [nom, quantite, qui] of [
        ["Lait demi-écrémé", "2 L", page],
        ["Pain complet", "", autre],
        ["Bananes", "1 kg", page],
        ["Beurre doux", "", autre],
        ["Café moulu", "", page],
        ["Pâtes", "2", autre],
      ]) {
        const formulaire = qui.locator("#form-ajout");
        await formulaire.getByLabel("Article à ajouter").fill(nom);
        await formulaire.getByLabel("Quantité (facultatif)").fill(quantite);
        await formulaire.getByRole("button", { name: "Ajouter l'article" }).click();
        await expect(page.locator("#liste-a-acheter")).toContainText(nom);
      }
      await autre.context().close();
      await page.getByRole("checkbox", { name: "Café moulu : à acheter" }).click();
      await page.getByRole("checkbox", { name: "Pâtes : à acheter" }).click();
    }
    await expect(page.locator("#liste-caddie .article")).toHaveCount(2);
    await expect(page.locator(".bouton-promos")).toHaveCount(3);
    await page.locator("#ajout-nom").blur();
    await page.screenshot({ path: `${DOSSIER}liste${suffixe}.png` });

    if (theme === "light") {
      // Glisser un article vers la gauche : le bouton « Supprimer » apparaît.
      const boite = await page.locator("#liste-a-acheter .article").filter({ hasText: "Beurre doux" }).boundingBox();
      const y = boite.y + boite.height / 2;
      await page.mouse.move(boite.x + boite.width - 40, y);
      await page.mouse.down();
      await page.mouse.move(boite.x + boite.width - 180, y, { steps: 10 });
      await page.mouse.up();
      await expect(page.getByRole("button", { name: "Supprimer Beurre doux" })).toBeVisible();
      await page.waitForTimeout(300); // fin de l'animation
      await page.screenshot({ path: `${DOSSIER}glisser.png` });
      await page.getByRole("button", { name: "Modifier Beurre doux" }).click(); // referme
    }

    await page.getByRole("button", { name: "Voir 2 promos pour Lait demi-écrémé" }).click();
    await expect(page.getByRole("dialog", { name: "Promos pour « Lait demi-écrémé »" })).toBeVisible();
    await page.screenshot({ path: `${DOSSIER}promos${suffixe}.png` });
    await page.getByRole("button", { name: "Fermer" }).click();

    // En écrivant un article : les promos qui correspondent.
    await page.getByLabel("Article à ajouter").fill("lait");
    await expect(page.locator("#etat-recherche")).toHaveText("4 promos");
    await page.getByLabel("Article à ajouter").blur();
    await page.screenshot({ path: `${DOSSIER}recherche${suffixe}.png` });
    await page.getByRole("button", { name: "Effacer" }).click();

    if (theme === "light") {
      await page.getByRole("button", { name: "Modifier Lait demi-écrémé" }).click();
      await page.getByLabel("Note").fill("sans lactose si possible");
      await page.screenshot({ path: `${DOSSIER}modifier.png` });
    }
  });
}

test("capture du conseil d'installation (Safari sur iPhone)", async ({ browser }) => {
  const contexte = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    locale: "fr-FR",
    baseURL: test.info().project.use.baseURL,
  });
  await servirPromos(contexte);
  const page = await contexte.newPage();
  await page.goto("");
  await page.getByLabel("E-mail").fill(COMPTE.email);
  await page.getByLabel("Mot de passe").fill(COMPTE.motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator("#conseil-installation")).toBeVisible();
  await expect(page.locator(".bouton-promos").first()).toBeVisible();
  await page.screenshot({ path: `${DOSSIER}installation.png` });
  await contexte.close();
});
