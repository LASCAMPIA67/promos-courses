// Captures d'écran de l'appli pour la documentation (docs/captures/).
// Lancement : npm run captures

import { expect, test } from "@playwright/test";

const PROJET = "demo-promos-courses";
const COMPTE = { uid: "ElRK8CEajUMQmtajHXv5qZVVT6G2", email: "emilio@exemple.test", motDePasse: "motdepasse-1" };
const DOSSIER = new URL("../../docs/captures/", import.meta.url).pathname;

test.skip(!process.env.CAPTURES, "captures seulement à la demande (CAPTURES=1)");
test.use({ deviceScaleFactor: 2 });

test.beforeAll(async ({ request }) => {
  await request.delete(`http://127.0.0.1:9099/emulator/v1/projects/${PROJET}/accounts`);
  await request.post(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJET}/accounts`, {
    headers: { Authorization: "Bearer owner" },
    data: { localId: COMPTE.uid, email: COMPTE.email, password: COMPTE.motDePasse },
  });
  await request.delete(`http://127.0.0.1:8080/emulator/v1/projects/${PROJET}/databases/(default)/documents`);
});

for (const theme of ["light", "dark"]) {
  test(`captures en mode ${theme === "light" ? "clair" : "sombre"}`, async ({ page }) => {
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
      const formulaire = page.locator("#form-ajout");
      for (const [nom, quantite] of [
        ["Lait demi-écrémé", "2 L"],
        ["Pain complet", ""],
        ["Bananes", "1 kg"],
        ["Beurre doux", ""],
        ["Café moulu", ""],
        ["Pâtes", "2"],
      ]) {
        await formulaire.getByLabel("Article à ajouter").fill(nom);
        await formulaire.getByLabel("Quantité (facultatif)").fill(quantite);
        await formulaire.getByRole("button", { name: "Ajouter l'article" }).click();
        await expect(page.locator("#liste-a-acheter")).toContainText(nom);
      }
      await page.getByRole("checkbox", { name: "Café moulu : à acheter" }).click();
      await page.getByRole("checkbox", { name: "Pâtes : à acheter" }).click();
    }
    await expect(page.locator("#liste-caddie .article")).toHaveCount(2);
    await page.locator("#ajout-nom").blur();
    await page.screenshot({ path: `${DOSSIER}liste${suffixe}.png` });

    if (theme === "light") {
      await page.getByRole("button", { name: "Modifier Lait demi-écrémé" }).click();
      await page.getByLabel("Note").fill("sans lactose si possible");
      await page.screenshot({ path: `${DOSSIER}modifier.png` });
    }
  });
}
