// Scénario réel : dans Safari sur iPhone, l'appli propose de s'installer sur l'écran d'accueil.

import { expect, test } from "@playwright/test";

import { COMPTES, creerComptes, seConnecter } from "./outils.js";

const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";

test.beforeAll(async ({ request }) => {
  await creerComptes(request, [COMPTES.un]);
});

test("dans Safari sur iPhone, l'appli propose de s'installer, puis se fait oublier", async ({ browser }) => {
  const contexte = await browser.newContext({ userAgent: SAFARI_IPHONE, viewport: { width: 393, height: 852 } });
  const page = await contexte.newPage();
  await seConnecter(page, COMPTES.un);

  const conseil = page.getByRole("complementary", { name: "Installez l'appli sur l'iPhone" });
  await expect(conseil).toBeVisible();
  await expect(conseil).toContainText("« Sur l'écran d'accueil »");
  await expect(conseil.getByRole("link", { name: "Voir le guide" })).toHaveAttribute(
    "href",
    /installation-iphone\.md$/,
  );

  // « Plus tard » : le conseil disparaît, et ne revient pas en rouvrant l'appli.
  await conseil.getByRole("button", { name: "Plus tard" }).click();
  await expect(conseil).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Liste de courses" })).toBeVisible();
  await expect(conseil).toBeHidden();
  await contexte.close();
});

test("sur un ordinateur, pas de conseil d'installation", async ({ browser }) => {
  const contexte = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36",
  });
  const page = await contexte.newPage();
  await seConnecter(page, COMPTES.un);
  await expect(page.locator("#conseil-installation")).toBeHidden();
  await contexte.close();
});
