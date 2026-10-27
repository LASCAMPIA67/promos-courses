// Captures d'écran de l'appli pour la documentation (docs/captures/).
// Lancement : npm run captures

import { expect, test } from "@playwright/test";

import { choisirFichier, pdfExemple } from "./fichiers-exemple.js";
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
      const photo = Buffer.from(await page.evaluate(dessinerTicket), "base64");
      await choisirFichier(page, ajouterTicket, { name: "IMG_0042.png", mimeType: "image/png", buffer: photo });
      const nouveau = page.getByRole("dialog", { name: "Nouveau ticket" });
      await expect(nouveau.getByRole("img", { name: "Aperçu du ticket" })).toBeVisible();
      await nouveau.getByLabel("Montant").fill("23,45");
      await page.screenshot({ path: `${DOSSIER}ajout-ticket.png` });
      await nouveau.getByRole("button", { name: "Enregistrer" }).click();
      await choisirFichier(page, ajouterTicket, {
        name: "ticket-lidl.pdf",
        mimeType: "application/pdf",
        buffer: pdfExemple(),
      });
      await nouveau.getByLabel("Montant").fill("2,54");
      await nouveau.getByRole("button", { name: "Enregistrer" }).click();
      await expect(page.locator("#liste-tickets .ticket")).toHaveCount(2);
      await expect(page.locator("#liste-tickets")).not.toContainText("envoi en cours");
      await page.locator("#liste-tickets").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${DOSSIER}tickets.png` });

      await page.getByRole("button", { name: /^Ouvrir le ticket Leclerc · / }).click();
      await expect(page.getByRole("img", { name: "Photo du ticket de caisse" })).toBeVisible();
      await page.screenshot({ path: `${DOSSIER}ticket.png` });
    }
  });
}

/** Un ticket de caisse fictif, dessiné dans le navigateur (image PNG en base64). */
function dessinerTicket() {
  const toile = document.createElement("canvas");
  toile.width = 560;
  toile.height = 900;
  const dessin = toile.getContext("2d");
  dessin.fillStyle = "#ffffff";
  dessin.fillRect(0, 0, toile.width, toile.height);
  dessin.fillStyle = "#222222";
  dessin.font = "bold 30px monospace";
  dessin.textAlign = "center";
  dessin.fillText("MAGASIN EXEMPLE", 280, 70);
  dessin.font = "22px monospace";
  dessin.fillText("Ticket fictif pour la documentation", 280, 110);
  dessin.textAlign = "left";
  const lignes = [
    ["LAIT DEMI-ECREME 2 L", "1,78"],
    ["PAIN COMPLET", "1,65"],
    ["BANANES 1 KG", "1,29"],
    ["BEURRE DOUX", "2,49"],
    ["CAFE MOULU 1 KG", "9,99"],
    ["PATES SPAGHETTI x2", "1,90"],
    ["CHOCOLAT AU LAIT", "2,15"],
    ["YAOURTS NATURE x8", "2,20"],
  ];
  lignes.forEach(([produit, prix], rang) => {
    const y = 190 + rang * 52;
    dessin.fillText(produit, 40, y);
    dessin.fillText(prix, 440, y);
  });
  dessin.fillRect(40, 640, 480, 3);
  dessin.font = "bold 30px monospace";
  dessin.fillText("TOTAL", 40, 700);
  dessin.fillText("23,45 EUR", 340, 700);
  dessin.font = "22px monospace";
  dessin.fillText("Merci de votre visite", 140, 800);
  return toile.toDataURL("image/png").split(",")[1];
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
