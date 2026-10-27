// Scénarios réels sur l'émulateur Firebase, avec les mêmes règles d'accès que la vraie base.

import { expect, test } from "@playwright/test";

import { COMPTES, aAcheter, ajouter, caddie, creerComptes, seConnecter, viderLaBase } from "./outils.js";

test.beforeAll(async ({ request }) => {
  await creerComptes(request);
});

test.beforeEach(async ({ request }) => {
  await viderLaBase(request);
});

test("un mauvais mot de passe est refusé avec un message clair", async ({ page }) => {
  await page.goto("");
  await page.getByLabel("E-mail").fill(COMPTES.un.email);
  await page.getByLabel("Mot de passe").fill("pas-le-bon");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("alert")).toHaveText("E-mail ou mot de passe incorrect.");
});

test("ajouter, cocher, modifier et supprimer des articles", async ({ page }) => {
  await seConnecter(page, COMPTES.un);
  await expect(page.getByText("La liste est vide")).toBeVisible();

  await ajouter(page, "Lait demi-écrémé", "2 L");
  await ajouter(page, "Pain");
  // Rangés par rayon, dans l'ordre du magasin : la boulangerie avant le frais.
  await expect(aAcheter(page).locator(".titre-rayon")).toHaveText(["Boulangerie", "Frais"]);
  await expect(aAcheter(page).locator(".nom")).toHaveText(["Pain", "Lait demi-écrémé"]);
  // Sous le nom : quand il a été ajouté, puis la quantité.
  await expect(aAcheter(page).locator(".article").filter({ hasText: "Lait" }).locator(".details")).toHaveText(
    /^\d\d:\d\d · 2 L$/,
  );

  // Un doublon est signalé au lieu d'être ajouté.
  await ajouter(page, "lait demi ecreme");
  await expect(page.locator("#message-ajout")).toHaveText("« Lait demi-écrémé » est déjà dans la liste.");
  await expect(aAcheter(page).locator(".article")).toHaveCount(2);

  // Un rayon mal deviné se corrige, et c'est retenu pour ce nom d'article (sur les deux téléphones).
  await page.getByRole("button", { name: "Modifier Pain" }).click();
  const fenetrePain = page.getByRole("dialog", { name: "Modifier l'article" });
  await expect(fenetrePain.getByLabel("Rayon")).toHaveValue("boulangerie");
  await fenetrePain.getByLabel("Rayon").selectOption({ label: "Épicerie sucrée" });
  await fenetrePain.getByRole("button", { name: "Enregistrer" }).click();
  await expect(aAcheter(page).locator(".titre-rayon")).toHaveText(["Épicerie sucrée", "Frais"]);

  // Cocher : l'article passe dans le caddie.
  await page.getByRole("checkbox", { name: "Pain : à acheter" }).click();
  await expect(caddie(page).locator(".nom")).toHaveText(["Pain"]);
  await expect(page.getByRole("heading", { name: "Dans le caddie (1)" })).toBeVisible();

  // Modifier : nom, quantité et note.
  await page.getByRole("button", { name: "Modifier Lait demi-écrémé" }).click();
  const fenetre = page.getByRole("dialog", { name: "Modifier l'article" });
  await fenetre.getByLabel("Nom").fill("Lait entier");
  await fenetre.getByLabel("Quantité").fill("1 L");
  await fenetre.getByLabel("Note").fill("bio si possible");
  await fenetre.getByRole("button", { name: "Enregistrer" }).click();
  await expect(aAcheter(page)).toContainText("Lait entier");
  await expect(aAcheter(page)).toContainText("1 L · bio si possible");

  // Supprimer, avec confirmation.
  await page.getByRole("button", { name: "Modifier Lait entier" }).click();
  await page.getByRole("button", { name: "Supprimer l'article" }).click();
  await expect(page.getByText("Supprimer « Lait entier » de la liste ?")).toBeVisible();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("La liste est vide")).toBeVisible();

  // Vider le caddie.
  await page.getByRole("button", { name: "Tout retirer" }).click();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.locator("#section-caddie")).toBeHidden();
});

test("glisser un article vers la gauche pour le supprimer, avec « Annuler »", async ({ page }) => {
  await seConnecter(page, COMPTES.un);
  await ajouter(page, "Pain");
  await ajouter(page, "Beurre");
  await page.getByRole("checkbox", { name: "Beurre : à acheter" }).click();
  await expect(caddie(page)).toContainText("Beurre");

  // Glisser « Pain » vers la gauche : le bouton « Supprimer » apparaît.
  const glisser = async (ligne) => {
    // La liste peut être redessinée à cet instant (confirmation du serveur) : on attend sa position.
    let boite = null;
    await expect.poll(async () => (boite = await ligne.boundingBox())).not.toBeNull();
    const y = boite.y + boite.height / 2;
    await page.mouse.move(boite.x + boite.width - 40, y);
    await page.mouse.down();
    await page.mouse.move(boite.x + boite.width - 180, y, { steps: 10 });
    await page.mouse.up();
  };
  await glisser(aAcheter(page).locator(".article").filter({ hasText: "Pain" }));
  await page.getByRole("button", { name: "Supprimer Pain" }).click();
  await expect(aAcheter(page)).not.toContainText("Pain");

  // Supprimé par erreur : « Annuler » le remet.
  await expect(page.getByText("« Pain » supprimé.")).toBeVisible();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(aAcheter(page).locator(".nom")).toHaveText(["Pain"]);

  // Depuis le caddie aussi ; l'article revient dans le caddie.
  await glisser(caddie(page).locator(".article").filter({ hasText: "Beurre" }));
  await page.getByRole("button", { name: "Supprimer Beurre" }).click();
  await expect(page.locator("#section-caddie")).toBeHidden();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(caddie(page)).toContainText("Beurre");

  // Toucher une ligne ouverte la referme, sans ouvrir l'article.
  await glisser(aAcheter(page).locator(".article").filter({ hasText: "Pain" }));
  await expect(page.getByRole("button", { name: "Supprimer Pain" })).toBeVisible();
  await page.getByRole("button", { name: "Modifier Pain" }).click();
  await expect(page.getByRole("button", { name: "Supprimer Pain" })).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Modifier l'article" })).toBeHidden();
});

test("les deux téléphones voient les changements de l'autre en direct", async ({ browser }) => {
  const telephone1 = await (await browser.newContext()).newPage();
  const telephone2 = await (await browser.newContext()).newPage();
  await seConnecter(telephone1, COMPTES.un);
  await seConnecter(telephone2, COMPTES.deux);

  await ajouter(telephone1, "Beurre doux");
  await expect(aAcheter(telephone2)).toContainText("Beurre doux");

  await telephone2.getByRole("checkbox", { name: "Beurre doux : à acheter" }).click();
  await expect(caddie(telephone1)).toContainText("Beurre doux");

  await telephone1.context().close();
  await telephone2.context().close();
});

test("sans réseau, l'appli continue de marcher et envoie tout au retour du réseau", async ({ browser }) => {
  const telephone1 = await (await browser.newContext()).newPage();
  const telephone2 = await (await browser.newContext()).newPage();
  await seConnecter(telephone1, COMPTES.un);
  await seConnecter(telephone2, COMPTES.deux);

  await telephone1.context().setOffline(true);
  await expect(telephone1.getByRole("status").filter({ hasText: "Hors connexion" })).toBeVisible();
  await ajouter(telephone1, "Œufs", "12");
  await expect(aAcheter(telephone1)).toContainText("Œufs");

  await telephone1.context().setOffline(false);
  await expect(aAcheter(telephone2)).toContainText("Œufs");
  await expect(telephone1.getByText("Hors connexion")).toBeHidden();

  await telephone1.context().close();
  await telephone2.context().close();
});

test("chacun choisit son prénom et sa couleur : l'autre téléphone voit qui a ajouté quoi", async ({ browser }) => {
  const telephone1 = await (await browser.newContext()).newPage();
  const telephone2 = await (await browser.newContext()).newPage();
  await seConnecter(telephone1, COMPTES.un);
  await seConnecter(telephone2, COMPTES.deux);

  // Sans prénom, l'enregistrement est refusé avec un message clair.
  await telephone1.getByRole("button", { name: "Mon compte" }).click();
  const compte = telephone1.getByRole("dialog", { name: "Mon compte" });
  await compte.getByLabel("Prénom").fill(" ");
  await compte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(compte.getByRole("alert")).toHaveText("Écrivez votre prénom.");

  await compte.getByLabel("Prénom").fill("Camille");
  await compte.getByRole("radio", { name: "Rose" }).check();
  await compte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(compte).toBeHidden();

  // Sur l'autre téléphone : la pastille rose et l'heure d'ajout à côté de l'article.
  await ajouter(telephone1, "Pommes");
  const ligne = aAcheter(telephone2).locator(".article").filter({ hasText: "Pommes" });
  await expect(ligne.locator(".pastille-membre")).toHaveAttribute("data-couleur", "rose");
  await expect(ligne.locator(".details")).toHaveText(/^\d\d:\d\d$/);
  await telephone2.getByRole("button", { name: /^Modifier Pommes.*, ajouté par Camille$/ }).click();
  await expect(telephone2.locator("#auteur-article")).toHaveText(/^Ajouté par Camille aujourd'hui à \d\d:\d\d$/);
  await telephone2.getByRole("button", { name: "Annuler" }).click();

  // Et dans « Mon compte », la légende des couleurs.
  await telephone2.getByRole("button", { name: "Mon compte" }).click();
  await expect(telephone2.locator("#legende-membres")).toContainText("Camille");
  await expect(telephone2.locator("#legende-membres .pastille-membre[data-couleur='rose']")).toHaveCount(1);

  await telephone1.context().close();
  await telephone2.context().close();
});

test("un autre compte Firebase n'a pas accès à la liste", async ({ page }) => {
  await seConnecter(page, COMPTES.intrus);
  await expect(page.locator("#bandeau")).toHaveText("Ce compte n'a pas accès à la liste de courses.");
});

test("se déconnecter ramène à l'écran de connexion", async ({ page }) => {
  await seConnecter(page, COMPTES.deux);
  await page.getByRole("button", { name: "Mon compte" }).click();
  await expect(page.getByText(COMPTES.deux.email)).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
});
