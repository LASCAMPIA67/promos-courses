// Scénarios réels : garder les tickets de caisse (photo, capture d'écran ou PDF) avec la liste.

import { expect, test } from "@playwright/test";

import { choisirFichier, pdfExemple, pngExemple } from "./fichiers-exemple.js";
import { COMPTES, ajouter, creerComptes, seConnecter, viderLaBase } from "./outils.js";

test.beforeAll(async ({ request }) => {
  await creerComptes(request);
});

test.beforeEach(async ({ request }) => {
  await viderLaBase(request);
});

const boutonAjouter = (page) => page.getByRole("button", { name: "Ajouter un ticket de caisse" });
const tickets = (page) => page.locator("#liste-tickets .ticket");
const photo = { name: "IMG_0042.png", mimeType: "image/png", buffer: pngExemple() };

test("un ticket en photo : vu en grand sur les deux téléphones, corrigé, puis supprimé", async ({ browser }) => {
  const telephone1 = await (await browser.newContext()).newPage();
  const telephone2 = await (await browser.newContext()).newPage();
  await seConnecter(telephone1, COMPTES.un);
  await seConnecter(telephone2, COMPTES.deux);

  // Choisir la photo : aperçu, magasin (Leclerc d'office), date du jour, montant.
  await choisirFichier(telephone1, boutonAjouter(telephone1), photo);
  const fenetre = telephone1.getByRole("dialog", { name: "Nouveau ticket" });
  await expect(fenetre.getByRole("img", { name: "Aperçu du ticket" })).toBeVisible();
  await expect(fenetre.getByRole("radio", { name: "Leclerc" })).toBeChecked();
  await fenetre.getByRole("radio", { name: "Lidl" }).check();
  await fenetre.getByLabel("Montant").fill("beaucoup");
  await fenetre.getByRole("button", { name: "Enregistrer" }).click();
  await expect(fenetre.getByRole("alert")).toHaveText("Montant incompréhensible (exemple : 54,30).");
  await fenetre.getByLabel("Montant").fill("23,45");
  await fenetre.getByLabel("Note").fill("garantie de la bouilloire");
  await fenetre.getByRole("button", { name: "Enregistrer" }).click();
  await expect(fenetre).toBeHidden();

  // Sur l'autre téléphone, directement sous la liste.
  await expect(tickets(telephone2)).toHaveCount(1);
  await expect(tickets(telephone2)).toContainText("Lidl");
  await expect(tickets(telephone2)).toContainText("23,45 €");
  await expect(tickets(telephone2)).toContainText("garantie de la bouilloire");

  // En grand : la photo, allégée mais à sa taille (300 pixels de large : rien à réduire).
  await telephone2.getByRole("button", { name: /^Ouvrir le ticket Lidl du / }).click();
  const ticket = telephone2.getByRole("dialog", { name: /^Lidl, / });
  const image = ticket.getByRole("img", { name: "Photo du ticket de caisse" });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBe(300);
  await expect(ticket.locator("#infos-ticket")).toContainText("23,45 € · garantie de la bouilloire · ajouté par");

  // Corriger le montant : l'autre téléphone le voit aussitôt.
  await ticket.getByRole("button", { name: "Modifier" }).click();
  const correction = telephone2.getByRole("dialog", { name: "Modifier le ticket" });
  await expect(correction.getByLabel("Montant")).toHaveValue("23,45");
  await correction.getByLabel("Montant").fill("25");
  await correction.getByRole("button", { name: "Enregistrer" }).click();
  await expect(ticket.locator("#infos-ticket")).toContainText("25,00 €");
  await expect(tickets(telephone1)).toContainText("25,00 €");

  // Supprimer, avec confirmation.
  await ticket.getByRole("button", { name: "Supprimer" }).click();
  await telephone2.getByRole("button", { name: "Confirmer" }).click();
  await expect(ticket).toBeHidden();
  await expect(tickets(telephone1)).toHaveCount(0);

  await telephone1.context().close();
  await telephone2.context().close();
});

test("un ticket en PDF (appli du magasin) : chaque page affichée, et partagé", async ({ page }) => {
  // La feuille de partage de l'iPhone, remplacée par un espion.
  await page.addInitScript(() => {
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => {
      window.partage = files.map((f) => `${f.name} ${f.type} ${f.size}`);
    };
  });
  await seConnecter(page, COMPTES.un);
  const pdf = pdfExemple();
  await choisirFichier(page, boutonAjouter(page), {
    name: "ticket-lidl.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  const fenetre = page.getByRole("dialog", { name: "Nouveau ticket" });
  await expect(fenetre.locator(".apercu-pdf")).toHaveText("PDF · 1 Ko");
  await expect(fenetre.getByRole("radio", { name: "Lidl" })).toBeChecked(); // deviné d'après le nom
  await fenetre.getByRole("button", { name: "Enregistrer" }).click();

  await page.getByRole("button", { name: /^Ouvrir le ticket Lidl du / }).click();
  const ticket = page.getByRole("dialog", { name: /^Lidl, / });
  const pagePdf = ticket.getByRole("img", { name: "Page 1 du ticket" });
  await expect(pagePdf).toBeVisible({ timeout: 20_000 });
  // La page est vraiment dessinée : il y a du texte (des pixels foncés) sur le fond blanc.
  await expect
    .poll(() =>
      pagePdf.evaluate((toile) => {
        const { data } = toile.getContext("2d").getImageData(0, 0, toile.width, toile.height);
        let fonces = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] < 100) fonces += 1;
        return fonces;
      }),
    )
    .toBeGreaterThan(100);

  // Partager : le PDF d'origine, intact, avec un nom clair.
  await ticket.getByRole("button", { name: "Partager" }).click();
  const jour = await page.evaluate(() => new Date().toLocaleDateString("sv-SE"));
  await expect
    .poll(() => page.evaluate(() => window.partage))
    .toEqual([`ticket-lidl-${jour}.pdf application/pdf ${pdf.length}`]);
});

test("après « Tout retirer », l'appli propose d'ajouter le ticket ; au-delà de 3, « Voir les tickets »", async ({
  page,
}) => {
  await seConnecter(page, COMPTES.un);
  await ajouter(page, "Pain");
  await page.getByRole("checkbox", { name: "Pain : à acheter" }).click();
  await page.getByRole("button", { name: "Tout retirer" }).click();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Courses finies : garder le ticket ?")).toBeVisible();
  await choisirFichier(page, page.getByRole("button", { name: "Ajouter", exact: true }), photo);
  await page.getByRole("dialog", { name: "Nouveau ticket" }).getByRole("button", { name: "Enregistrer" }).click();
  await expect(tickets(page)).toHaveCount(1);

  // Trois tickets sous la liste au plus ; les autres dans « Voir les tickets », par mois.
  for (let n = 0; n < 3; n += 1) {
    await choisirFichier(page, boutonAjouter(page), photo);
    await page.getByRole("dialog", { name: "Nouveau ticket" }).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("dialog", { name: "Nouveau ticket" })).toBeHidden();
  }
  await expect(tickets(page)).toHaveCount(3);
  await page.getByRole("button", { name: "Voir les 4 tickets" }).click();
  const tous = page.getByRole("dialog", { name: "Tickets de caisse" });
  await expect(tous.locator(".ticket")).toHaveCount(4);
  const mois = await page.evaluate(() => new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  await expect(tous.getByRole("heading", { level: 3 })).toHaveText(mois.charAt(0).toUpperCase() + mois.slice(1));
});

test("un autre compte Firebase ne voit pas les tickets", async ({ page, browser }) => {
  await seConnecter(page, COMPTES.un);
  await choisirFichier(page, boutonAjouter(page), photo);
  await page.getByRole("dialog", { name: "Nouveau ticket" }).getByRole("button", { name: "Enregistrer" }).click();
  await expect(tickets(page)).toHaveCount(1);
  await expect(tickets(page)).not.toContainText("envoi en cours");

  const intrus = await (await browser.newContext()).newPage();
  await seConnecter(intrus, COMPTES.intrus);
  await expect(intrus.locator("#bandeau")).toHaveText("Ce compte n'a pas accès à la liste de courses.");
  await expect(tickets(intrus)).toHaveCount(0);
  await intrus.context().close();
});

test("sans réseau, le ticket est gardé sur le téléphone et envoyé au retour du réseau", async ({ browser }) => {
  const telephone1 = await (await browser.newContext()).newPage();
  const telephone2 = await (await browser.newContext()).newPage();
  await seConnecter(telephone1, COMPTES.un);
  await seConnecter(telephone2, COMPTES.deux);

  await telephone1.context().setOffline(true);
  await choisirFichier(telephone1, boutonAjouter(telephone1), photo);
  await telephone1.getByRole("dialog", { name: "Nouveau ticket" }).getByRole("button", { name: "Enregistrer" }).click();
  await expect(tickets(telephone1)).toContainText("envoi en cours…");
  // Il s'ouvre déjà, depuis le téléphone.
  await telephone1.getByRole("button", { name: /^Ouvrir le ticket Leclerc du / }).click();
  await expect(telephone1.getByRole("img", { name: "Photo du ticket de caisse" })).toBeVisible();
  await telephone1.getByRole("button", { name: "Fermer" }).click();

  await telephone1.context().setOffline(false);
  await expect(tickets(telephone2)).toHaveCount(1);
  await expect(tickets(telephone1)).not.toContainText("envoi en cours…");

  await telephone1.context().close();
  await telephone2.context().close();
});
