// Scénarios réels : « Mettre à jour les promos » lance le robot depuis l'appli et montre son avancée.
// GitHub est simulé : aucune vraie clé, aucun vrai lancement.

import { expect, test } from "@playwright/test";

import { CLE, simulerGitHub } from "./github-exemple.js";
import { COMPTES, creerComptes, seConnecter, viderLaBase } from "./outils.js";
import { promosExemple, servirPromos } from "./promos-exemple.js";

test.beforeAll(async ({ request }) => {
  await creerComptes(request);
});

test.beforeEach(async ({ request }) => {
  await viderLaBase(request);
});

const compte = (page) => page.getByRole("dialog", { name: "Mon compte" });
const avancee = (page) => page.getByRole("dialog", { name: "Mise à jour des promos" });
const etape = (page, rang) => avancee(page).locator(".etape-robot").nth(rang);

test("« Mettre à jour les promos » : la clé une seule fois, puis l'avancée du robot étape par étape", async ({
  browser,
}) => {
  const telephone1 = await (await browser.newContext()).newPage();
  const telephone2 = await (await browser.newContext()).newPage();
  const hier = new Date(Date.now() - 24 * 3_600_000);
  for (const telephone of [telephone1, telephone2]) await servirPromos(telephone.context(), { miseAJour: hier });
  const github1 = await simulerGitHub(telephone1.context());
  const github2 = await simulerGitHub(telephone2.context(), { toutSeul: true });
  await seConnecter(telephone1, COMPTES.un);
  await seConnecter(telephone2, COMPTES.deux);

  // Mon compte : la date des promos, et le bouton.
  await telephone1.getByRole("button", { name: "Mon compte" }).click();
  await expect(compte(telephone1).locator("#etat-robot")).toHaveText(/^Promos mises à jour hier à /);
  await compte(telephone1).getByRole("button", { name: "Mettre à jour les promos" }).click();

  // Pas encore de clé : l'appli explique, avec un lien vers la page de GitHub déjà remplie.
  const lien = compte(telephone1).getByRole("link", { name: "Créer la clé sur GitHub" });
  await expect(lien).toHaveAttribute("href", /^https:\/\/github\.com\/settings\/personal-access-tokens\/new\?/);
  await compte(telephone1).getByLabel("Clé GitHub").fill("mon mot de passe");
  await compte(telephone1).getByRole("button", { name: "Enregistrer et lancer" }).click();
  await expect(compte(telephone1).getByRole("alert")).toHaveText(
    "Ce n'est pas une clé GitHub : elle commence par « github_pat_ ».",
  );
  expect(github1.lancements).toHaveLength(0);

  // La bonne clé : le robot est lancé et la fenêtre d'avancée s'ouvre.
  await telephone1
    .context()
    .route("**/promos-test.json", (requete) => requete.fulfill({ json: promosExemple({ multiplier: 2 }) }));
  await compte(telephone1).getByLabel("Clé GitHub").fill(CLE);
  await compte(telephone1).getByRole("button", { name: "Enregistrer et lancer" }).click();
  await expect(compte(telephone1)).toBeHidden();
  await expect(avancee(telephone1)).toBeVisible();
  await expect(avancee(telephone1).locator(".titre-etape")).toHaveText([
    "Démarrage",
    "Lecture des catalogues Leclerc",
    "Photos et logos",
    "Enregistrement",
    "Nouvelles promos dans l'appli",
  ]);
  expect(github1.lancements).toEqual([{ cle: `Bearer ${CLE}`, corps: { ref: "main" } }]);

  // 1. En attente d'une machine GitHub.
  await expect(etape(telephone1, 0)).toHaveAttribute("data-etat", "en_cours");
  await expect(etape(telephone1, 0)).toContainText("En attente d'une machine GitHub…");
  await expect(avancee(telephone1).getByRole("status")).toHaveText(/^Commencé il y a \d+ min\.$/);

  // 2. Les catalogues : le démarrage est fait (avec sa durée), le robot dit lequel il lit.
  github1.avancer();
  await expect(etape(telephone1, 1)).toHaveAttribute("data-etat", "en_cours");
  await expect(etape(telephone1, 1)).toContainText("Catalogue 3 sur 9 : Un automne en fête");
  await expect(etape(telephone1, 0)).toHaveAttribute("data-etat", "fait");
  await expect(etape(telephone1, 0).locator(".duree-etape")).toHaveText("59 s");
  await expect(etape(telephone1, 2)).toHaveAttribute("data-etat", "a_venir");
  // En haut de la liste aussi, avec de quoi rouvrir la fenêtre.
  await avancee(telephone1).getByRole("button", { name: "Fermer" }).click();
  await expect(telephone1.locator("#etat-promos")).toContainText(
    "Mise à jour des promos — Catalogue 3 sur 9 : Un automne en fête",
  );

  // 3. Les photos, comptées.
  github1.avancer();
  await expect(telephone1.locator("#etat-promos")).toContainText("Photos : 312 sur 1 450 (12 nouvelles)");
  await telephone1.getByRole("button", { name: "Voir l'avancée" }).click();
  await expect(etape(telephone1, 2)).toHaveAttribute("data-etat", "en_cours");
  await expect(avancee(telephone1).getByRole("link", { name: "Détail sur GitHub" })).toHaveAttribute(
    "href",
    /\/actions\/runs\/2$/,
  );

  // 4. Fini : tout est fait, et les nouvelles promos sont dans l'appli, sans la recharger.
  github1.avancer();
  for (let rang = 0; rang < 5; rang += 1) await expect(etape(telephone1, rang)).toHaveAttribute("data-etat", "fait");
  await expect(avancee(telephone1).getByRole("status")).toHaveText("Terminé en 4 min : les promos sont à jour.");
  await expect(telephone1.locator("#etat-promos")).toContainText("Promos mises à jour.");
  await avancee(telephone1).getByRole("button", { name: "Fermer" }).click();
  await telephone1.getByLabel("Article à ajouter").fill("lait");
  await expect(telephone1.locator("#etat-recherche")).toHaveText("8 promos");

  // L'autre téléphone a la clé aussi : un seul geste.
  await telephone2.getByRole("button", { name: "Mon compte" }).click();
  await compte(telephone2).getByRole("button", { name: "Mettre à jour les promos" }).click();
  await expect(avancee(telephone2).getByRole("status")).toHaveText("Terminé en 4 min : les promos sont à jour.");
  expect(github2.lancements).toEqual([{ cle: `Bearer ${CLE}`, corps: { ref: "main" } }]);

  await telephone1.context().close();
  await telephone2.context().close();
});

test("une clé refusée (expirée) : l'appli demande d'en coller une nouvelle", async ({ page, context }) => {
  await servirPromos(context);
  await simulerGitHub(context, { refus: true });
  await seConnecter(page, COMPTES.un);
  await page.getByRole("button", { name: "Mon compte" }).click();
  await compte(page).getByRole("button", { name: "Mettre à jour les promos" }).click();
  await compte(page).getByLabel("Clé GitHub").fill(CLE);
  await compte(page).getByLabel("Clé GitHub").press("Enter"); // « Entrée » enregistre la clé, sans fermer
  await expect(compte(page).getByRole("alert")).toHaveText("Clé GitHub refusée ou expirée : collez-en une nouvelle.");
  await expect(compte(page).getByLabel("Clé GitHub")).toBeVisible();
  await expect(avancee(page)).toBeHidden();
});
