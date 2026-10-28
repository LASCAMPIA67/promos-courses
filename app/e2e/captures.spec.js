// Captures d'écran de l'appli pour la documentation (docs/captures/).
// Lancement : npm run captures

import { expect, test } from "@playwright/test";

import { choisirFichier, dessinerTicket, pdfExemple } from "./fichiers-exemple.js";
import { COMPTES, creerComptes, seConnecter, viderLaBase } from "./outils.js";
import { servirPromos } from "./promos-exemple.js";

const COMPTE = COMPTES.un;
const AUTRE = COMPTES.deux;
const DOSSIER = new URL("../../docs/captures/", import.meta.url).pathname;

test.skip(!process.env.CAPTURES, "captures seulement à la demande (CAPTURES=1)");
// Sans animations : chaque capture montre l'écran une fois en place (pas une fenêtre en train de s'ouvrir).
test.use({ deviceScaleFactor: 2, reducedMotion: "reduce" });

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
    test.slow(); // la lecture du ticket en photo prend quelques secondes
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
      const autre = await (
        await page.context().browser().newContext({ baseURL: test.info().project.use.baseURL })
      ).newPage();
      await servirPromos(autre.context());
      await seConnecter(autre, AUTRE);
      await (await choisirFiche(autre, "Alex", "Orange")).getByRole("button", { name: "Enregistrer" }).click();
      const fenetre = await choisirFiche(page, "Camille", "Vert");
      await expect(page.locator("#legende-membres")).toContainText("Alex");
      await page.screenshot({ path: `${DOSSIER}compte.png` });
      await fenetre.getByRole("button", { name: "Enregistrer" }).click();

      // Trois articles ajoutés depuis une promo (« + Ajouter »), les autres écrits à la main.
      for (const [recherche, nom, qui] of [
        ["lait", "Lait demi-écrémé", page],
        ["pain", "Pain de mie complet", autre],
        ["bananes", "Bananes", page],
      ]) {
        await qui.getByLabel("Article à ajouter").fill(recherche);
        await qui.getByRole("button", { name: `Ajouter ${nom} à la liste`, exact: true }).click();
        await qui.getByRole("button", { name: "Effacer" }).click();
        await expect(page.locator("#liste-a-acheter")).toContainText(nom);
      }
      for (const [nom, quantite, qui] of [
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
      // eslint-disable-next-line playwright/no-wait-for-timeout -- la fin de l'animation, pour une image nette
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${DOSSIER}glisser.png` });
      await page.getByRole("button", { name: "Modifier Beurre doux" }).click(); // referme
    }

    await page.getByRole("button", { name: /^Voir la promo de Lait demi-écrémé/i }).click();
    await expect(page.getByRole("dialog", { name: "Promo pour « Lait demi-écrémé »" })).toBeVisible();
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
      await page
        .getByRole("dialog", { name: "Modifier l'article" })
        .getByLabel("Note")
        .fill("sans lactose si possible");
      await page.screenshot({ path: `${DOSSIER}modifier.png` });
      await page.getByRole("button", { name: "Annuler" }).click();

      // Les tickets de caisse : une photo (un ticket fictif, dessiné ici) et un PDF.
      const ajouterTicket = page.getByRole("button", { name: "Ajouter un ticket de caisse" });
      const date = await page.evaluate(() => new Date().toLocaleDateString("fr-FR"));
      const photo = Buffer.from(await page.evaluate(dessinerTicket, { date }), "base64");
      await choisirFichier(page, ajouterTicket, { name: "IMG_0042.png", mimeType: "image/png", buffer: photo });
      const nouveau = page.getByRole("dialog", { name: "Nouveau ticket" });
      await expect(nouveau.getByRole("img", { name: "Aperçu du ticket" })).toBeVisible();
      // Le total et la date, lus tout seuls sur la photo.
      await expect(nouveau.getByRole("status")).toHaveText(/lus sur le ticket/, { timeout: 45_000 });
      await expect(nouveau.getByLabel("Montant")).toHaveValue("23,45");
      await page.screenshot({ path: `${DOSSIER}ajout-ticket.png` });
      await nouveau.getByRole("button", { name: "Enregistrer" }).click();
      await choisirFichier(page, ajouterTicket, {
        name: "e-ticket.pdf",
        mimeType: "application/pdf",
        buffer: pdfExemple(),
      });
      await expect(nouveau.getByLabel("Montant")).toHaveValue("2,54");
      await nouveau.getByRole("button", { name: "Enregistrer" }).click();
      await expect(page.locator("#liste-tickets .ticket")).toHaveCount(2);
      await expect(page.locator("#liste-tickets")).not.toContainText("envoi en cours");
      await page.locator("#liste-tickets").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${DOSSIER}tickets.png` });

      await page.getByRole("button", { name: /^Ouvrir le ticket Leclerc · .*23,45/ }).click();
      await expect(page.getByRole("img", { name: "Photo du ticket de caisse" })).toBeVisible();
      await page.screenshot({ path: `${DOSSIER}ticket.png` });
    }
  });
}

test("capture du conseil d'installation (Safari sur iPhone)", async ({ browser }) => {
  const contexte = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1",
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
