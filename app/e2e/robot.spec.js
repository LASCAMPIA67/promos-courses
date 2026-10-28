// Scénarios réels : « Mettre à jour les promos » lance le robot depuis l'appli. GitHub est simulé :
// aucune vraie clé, aucun vrai lancement.

import { expect, test } from "@playwright/test";

import { COMPTES, creerComptes, seConnecter, viderLaBase } from "./outils.js";
import { promosExemple, servirPromos } from "./promos-exemple.js";

const CLE = `github_pat_${"Exemple_42".repeat(4)}`;
const API = "https://api.github.com/repos/LASCAMPIA67/promos-courses";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Accept, Content-Type, X-GitHub-Api-Version",
};

test.beforeAll(async ({ request }) => {
  await creerComptes(request);
});

test.beforeEach(async ({ request }) => {
  await viderLaBase(request);
});

/**
 * Un GitHub simulé : chaque passage demandé « travaille » pendant deux questions, puis réussit.
 * `refus` : la clé est refusée. Renvoie la liste des lancements (avec la clé utilisée).
 */
async function simulerGitHub(contexte, { refus = false } = {}) {
  const lancements = [];
  const passages = [{ id: 1, status: "completed", conclusion: "success", tours: 0 }];
  await contexte.route(`${API}/**`, async (requete) => {
    const demande = requete.request();
    if (demande.method() === "OPTIONS") return requete.fulfill({ status: 204, headers: CORS });
    if (refus) return requete.fulfill({ status: 401, headers: CORS, json: { message: "Bad credentials" } });
    const chemin = new URL(demande.url()).pathname;
    if (chemin.endsWith("/robot.yml/dispatches")) {
      lancements.push({ cle: demande.headers().authorization, corps: demande.postDataJSON() });
      passages.unshift({ id: passages[0].id + 1, status: "queued", conclusion: null, tours: 0 });
      return requete.fulfill({ status: 204, headers: CORS });
    }
    if (chemin.endsWith("/robot.yml/runs")) {
      const dernier = passages[0];
      if (dernier.status !== "completed") {
        dernier.tours += 1;
        dernier.status = dernier.tours > 2 ? "completed" : "in_progress";
        if (dernier.status === "completed") dernier.conclusion = "success";
      }
      const maintenant = new Date().toISOString();
      const passage = { ...dernier, created_at: maintenant, run_started_at: maintenant, updated_at: maintenant };
      return requete.fulfill({ headers: CORS, json: { workflow_runs: [{ ...passage, html_url: "https://x.test" }] } });
    }
    return requete.fulfill({ status: 404, headers: CORS, json: {} });
  });
  return lancements;
}

const compte = (page) => page.getByRole("dialog", { name: "Mon compte" });

test("« Mettre à jour les promos » : la clé une seule fois, le robot suivi, les promos rechargées", async ({
  browser,
}) => {
  const telephone1 = await (await browser.newContext()).newPage();
  const telephone2 = await (await browser.newContext()).newPage();
  const hier = new Date(Date.now() - 24 * 3_600_000);
  for (const telephone of [telephone1, telephone2]) await servirPromos(telephone.context(), { miseAJour: hier });
  const lancements = await simulerGitHub(telephone1.context());
  const lancements2 = await simulerGitHub(telephone2.context());
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
  expect(lancements).toHaveLength(0);

  // La bonne clé : le robot est lancé, puis suivi, en haut de la liste aussi.
  await telephone1
    .context()
    .route("**/promos-test.json", (requete) => requete.fulfill({ json: promosExemple({ multiplier: 2 }) }));
  await compte(telephone1).getByLabel("Clé GitHub").fill(CLE);
  await compte(telephone1).getByRole("button", { name: "Enregistrer et lancer" }).click();
  await expect(compte(telephone1).locator("#etat-robot")).toHaveText(/^Le robot (démarre|travaille)/);
  await expect(compte(telephone1).getByLabel("Clé GitHub")).toBeHidden();
  await expect(compte(telephone1).locator("#etat-robot")).toHaveText("Promos mises à jour.");
  await expect(telephone1.locator("#etat-promos")).toHaveText("Promos mises à jour.");
  expect(lancements).toEqual([{ cle: `Bearer ${CLE}`, corps: { ref: "main" } }]);

  // Les nouvelles promos sont là, sans recharger l'appli.
  await compte(telephone1).getByRole("button", { name: "Fermer" }).click();
  await telephone1.getByLabel("Article à ajouter").fill("lait");
  await expect(telephone1.locator("#etat-recherche")).toHaveText("8 promos");

  // L'autre téléphone a la clé aussi : un seul geste.
  await telephone2.getByRole("button", { name: "Mon compte" }).click();
  await compte(telephone2).getByRole("button", { name: "Mettre à jour les promos" }).click();
  await expect(compte(telephone2).locator("#etat-robot")).toHaveText("Promos mises à jour.");
  await expect(compte(telephone2).getByLabel("Clé GitHub")).toBeHidden();
  expect(lancements2).toEqual([{ cle: `Bearer ${CLE}`, corps: { ref: "main" } }]);

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
  await expect(compte(page).getByRole("button", { name: "Mettre à jour les promos" })).toBeEnabled();
});
