import { describe, expect, test } from "vitest";

import {
  ADRESSE_NOUVELLE_CLE,
  ErreurRobot,
  adressePromosFraiches,
  cleValide,
  dernierPassage,
  lancerRobot,
  lirePassage,
  phrasePassage,
} from "../src/robot.js";

const CLE = `github_pat_${"A1b2_".repeat(8)}`;

/** Un faux « fetch » : note chaque appel et renvoie la réponse prévue. */
function fauxFetch(reponse) {
  const appels = [];
  const appel = async (adresse, options) => {
    appels.push({ adresse, ...options });
    if (reponse instanceof Error) throw reponse;
    return reponse;
  };
  appel.appels = appels;
  return appel;
}

const reponse = (status, corps = null) =>
  new Response(corps === null || typeof corps === "string" ? corps : JSON.stringify(corps), { status });

test("une clé GitHub « fine-grained » est reconnue ; le reste est refusé", () => {
  expect(cleValide(CLE)).toBe(true);
  expect(cleValide(`  ${CLE}  `)).toBe(true);
  expect(cleValide("ghp_ancienneCleClassique1234567890")).toBe(false);
  expect(cleValide("github_pat_court")).toBe(false);
  expect(cleValide("github_pat_avec des espaces et des signes !")).toBe(false);
  expect(cleValide(undefined)).toBe(false);
});

test("la page de création de clé est déjà remplie : ce dépôt, Actions en écriture, un an", () => {
  const adresse = new URL(ADRESSE_NOUVELLE_CLE);
  expect(adresse.origin + adresse.pathname).toBe("https://github.com/settings/personal-access-tokens/new");
  expect(Object.fromEntries(adresse.searchParams)).toMatchObject({
    target_name: "LASCAMPIA67",
    expires_in: "366",
    actions: "write",
  });
});

describe("lancer le robot", () => {
  test("demande à GitHub un passage du robot, sur la branche main, avec la clé", async () => {
    const appel = fauxFetch(reponse(204));
    await lancerRobot(CLE, appel);
    const [{ adresse, method, headers, body }] = appel.appels;
    expect(adresse).toBe(
      "https://api.github.com/repos/LASCAMPIA67/promos-courses/actions/workflows/robot.yml/dispatches",
    );
    expect(method).toBe("POST");
    expect(headers.Authorization).toBe(`Bearer ${CLE}`);
    expect(JSON.parse(body)).toEqual({ ref: "main" });
  });

  test("les refus sont expliqués en clair", async () => {
    const raison = (resultat) => lancerRobot(CLE, fauxFetch(resultat)).catch((erreur) => erreur);
    await expect(raison(reponse(401))).resolves.toMatchObject({ raison: "cle", message: /refusée ou expirée/ });
    await expect(raison(reponse(404))).resolves.toMatchObject({ raison: "cle", message: /promos-courses/ });
    await expect(raison(reponse(500))).resolves.toMatchObject({ raison: "github", message: /erreur 500/ });
    await expect(raison(new TypeError("Failed to fetch"))).resolves.toBeInstanceOf(ErreurRobot);
    await expect(raison(new TypeError("Failed to fetch"))).resolves.toMatchObject({ raison: "reseau" });
  });
});

describe("suivre un passage", () => {
  const passage = (champs) => ({
    id: 7,
    status: "in_progress",
    conclusion: null,
    created_at: "2026-10-28T07:24:00Z",
    run_started_at: "2026-10-28T07:24:05Z",
    updated_at: "2026-10-28T07:30:00Z",
    html_url: "https://github.com/LASCAMPIA67/promos-courses/actions/runs/7",
    ...champs,
  });

  test("en cours, réussi ou échoué", () => {
    expect(lirePassage(passage()).etat).toBe("en_cours");
    expect(lirePassage(passage({ status: "queued" })).etat).toBe("en_cours");
    expect(lirePassage(passage({ status: "completed", conclusion: "success" })).etat).toBe("reussi");
    expect(lirePassage(passage({ status: "completed", conclusion: "failure" })).etat).toBe("echoue");
    expect(lirePassage(passage({ status: "completed", conclusion: "cancelled" })).etat).toBe("echoue");
  });

  test("le dernier passage, ou aucun", async () => {
    const appel = fauxFetch(reponse(200, { workflow_runs: [passage()] }));
    expect(await dernierPassage(CLE, appel)).toMatchObject({ id: 7, etat: "en_cours" });
    expect(appel.appels[0].adresse).toMatch(/robot\.yml\/runs\?per_page=1$/);
    expect(await dernierPassage(CLE, fauxFetch(reponse(200, { workflow_runs: [] })))).toBeNull();
  });

  test("en clair", () => {
    const enCours = lirePassage(passage());
    expect(phrasePassage(enCours, new Date("2026-10-28T07:24:30Z"))).toBe("Le robot démarre…");
    expect(phrasePassage(enCours, new Date("2026-10-28T07:28:10Z"))).toBe("Le robot travaille depuis 4 min…");
    expect(phrasePassage(lirePassage(passage({ status: "completed", conclusion: "success" })))).toBe("Promos à jour.");
  });
});

test("les promos toutes fraîches : l'adresse de promos.json au dernier enregistrement", async () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const appel = fauxFetch(reponse(200, `${sha}\n`));
  expect(await adressePromosFraiches(CLE, appel)).toBe(
    `https://raw.githubusercontent.com/LASCAMPIA67/promos-courses/${sha}/promos.json`,
  );
  expect(appel.appels[0].headers.Accept).toBe("application/vnd.github.sha");
  await expect(adressePromosFraiches(CLE, fauxFetch(reponse(200, "<html>")))).rejects.toThrow(/inattendue/);
});
