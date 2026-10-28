import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import {
  ADRESSE_NOUVELLE_CLE,
  ErreurRobot,
  PHASES,
  adressePromosFraiches,
  avanceeDuPassage,
  cleValide,
  dernierPassage,
  detailsDuPassage,
  formaterDuree,
  lancerRobot,
  lirePassage,
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

describe("l'avancée détaillée d'un passage", () => {
  const debut = "2026-10-28T07:24:05Z";
  const enCours = { id: 9, etat: "en_cours", debut: new Date(debut), sha: "abc" };
  const etape = (name, status, conclusion = null, started_at = null, completed_at = null) => ({
    name,
    status,
    conclusion,
    started_at,
    completed_at,
  });
  const preparation = [
    etape("Set up job", "completed", "success", "2026-10-28T07:24:05Z", "2026-10-28T07:24:08Z"),
    etape("Vérifier si le robot est déjà passé aujourd'hui", "completed", "skipped"),
    etape("Récupérer le dépôt", "completed", "success", "2026-10-28T07:24:08Z", "2026-10-28T07:24:10Z"),
    etape("Installer Python", "completed", "success", "2026-10-28T07:24:10Z", "2026-10-28T07:24:30Z"),
    etape("Installer le robot", "completed", "success", "2026-10-28T07:24:30Z", "2026-10-28T07:24:50Z"),
    etape("Reprendre les photos déjà faites", "completed", "success", "2026-10-28T07:24:50Z", "2026-10-28T07:24:52Z"),
  ];
  const resume = (phases) => phases.map((phase) => `${phase.titre} : ${phase.etat}`);

  test("les étapes de l'appli correspondent exactement à celles du robot sur GitHub", () => {
    const robot = readFileSync(new URL("../../.github/workflows/robot.yml", import.meta.url), "utf8");
    const noms = [...robot.matchAll(/^ {6}- name: (.+)$/gm)].map(([, nom]) => nom.trim());
    const connus = PHASES.flatMap((phase) => phase.etapes).filter((nom) => nom !== "Set up job");
    expect(noms.sort()).toEqual([...connus].sort());
  });

  test("en attente d'une machine GitHub : le démarrage est en cours", () => {
    const phases = avanceeDuPassage(enCours, {});
    expect(resume(phases)).toEqual([
      "Démarrage : en_cours",
      "Lecture des catalogues Leclerc : a_venir",
      "Photos des produits : a_venir",
      "Enregistrement : a_venir",
    ]);
    expect(phases[0].detail).toBe("En attente d'une machine GitHub…");
  });

  test("pendant les photos : ce qui est fait, avec sa durée, ce qui est en cours, avec la nouvelle du robot", () => {
    const etapes = [
      ...preparation,
      etape("Lire les catalogues", "completed", "success", "2026-10-28T07:24:52Z", "2026-10-28T07:26:02Z"),
      etape("Fabriquer les photos", "in_progress", null, "2026-10-28T07:26:02Z"),
      etape("Enregistrer les photos", "queued"),
    ];
    const phases = avanceeDuPassage(
      enCours,
      { etapes, nouvelle: "Photos : 312 sur 1 450" },
      new Date("2026-10-28T07:35:02Z"),
    );
    expect(resume(phases)).toEqual([
      "Démarrage : fait",
      "Lecture des catalogues Leclerc : fait",
      "Photos des produits : en_cours",
      "Enregistrement : a_venir",
    ]);
    expect(phases.map((phase) => phase.duree)).toEqual([47_000, 70_000, 540_000, null]);
    expect(phases[2].detail).toBe("Photos : 312 sur 1 450");
  });

  test("entre deux étapes, la suivante est déjà « en cours »", () => {
    const phases = avanceeDuPassage(enCours, { etapes: [...preparation, etape("Lire les catalogues", "queued")] });
    expect(phases[1].etat).toBe("en_cours");
  });

  test("réussi : tout est fait ; échoué : l'étape en panne est signalée", () => {
    const reussi = avanceeDuPassage({ ...enCours, etat: "reussi" }, { etapes: preparation });
    expect(reussi.every((phase) => phase.etat === "fait")).toBe(true);
    const enPanne = [...preparation, etape("Lire les catalogues", "completed", "failure", debut, debut)];
    expect(resume(avanceeDuPassage({ ...enCours, etat: "echoue" }, { etapes: enPanne })).slice(0, 3)).toEqual([
      "Démarrage : fait",
      "Lecture des catalogues Leclerc : echoue",
      "Photos des produits : a_venir",
    ]);
    // Arrêté sans étape en panne (annulé) : la première étape pas finie est signalée.
    expect(avanceeDuPassage({ ...enCours, etat: "echoue" }, { etapes: preparation })[1].etat).toBe("echoue");
  });

  test("les étapes ajoutées par GitHub à la fin vont dans « Enregistrement »", () => {
    const etapes = [...preparation, etape("Post Installer Python", "in_progress", null, debut)];
    expect(avanceeDuPassage(enCours, { etapes })[3].etat).toBe("en_cours");
  });

  test("le détail vient de GitHub : les étapes, et la dernière nouvelle de ce passage seulement", async () => {
    const reponses = {
      "/actions/runs/9/jobs": { jobs: [{ steps: preparation }] },
      "/commits/abc/statuses": [
        { context: "autre", description: "x", created_at: "2026-10-28T07:30:00Z" },
        {
          context: "robot-promos/avancee",
          description: "Catalogue 2 sur 9 : Nos promos",
          created_at: "2026-10-28T07:25:00Z",
        },
        { context: "robot-promos/avancee", description: "Promos enregistrées", created_at: "2026-10-27T06:00:00Z" },
      ],
    };
    const appel = async (adresse) => {
      const chemin = new URL(adresse).pathname.replace("/repos/LASCAMPIA67/promos-courses", "");
      return new Response(JSON.stringify(reponses[chemin]), { status: 200 });
    };
    expect(await detailsDuPassage(CLE, enCours, appel)).toEqual({
      etapes: preparation,
      nouvelle: "Catalogue 2 sur 9 : Nos promos",
    });
    // Une nouvelle d'un passage d'hier sur le même enregistrement ne compte pas.
    reponses["/commits/abc/statuses"] = reponses["/commits/abc/statuses"].slice(2);
    expect((await detailsDuPassage(CLE, enCours, appel)).nouvelle).toBeNull();
  });
});

test("durées en clair", () => {
  expect(formaterDuree(45_400)).toBe("45 s");
  expect(formaterDuree(4 * 60_000 + 20_000)).toBe("4 min");
  expect(formaterDuree(65 * 60_000)).toBe("1 h 05");
});
