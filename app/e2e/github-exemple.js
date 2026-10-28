// Un GitHub simulé pour « Mettre à jour les promos » (scénarios réels et captures) : le robot
// lancé avance d'un moment à l'autre comme le vrai, sans aucune vraie clé ni vrai lancement.

export const CLE = `github_pat_${"Exemple_42".repeat(4)}`;
const API = "https://api.github.com/repos/LASCAMPIA67/promos-courses";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Accept, Content-Type, X-GitHub-Api-Version",
};

// Les étapes du robot sur GitHub (.github/workflows/robot.yml), et ce qu'il dit à chaque moment.
const ETAPES = [
  "Set up job",
  "Vérifier si le robot est déjà passé aujourd'hui",
  "Récupérer le dépôt",
  "Installer Python",
  "Installer le robot",
  "Reprendre les photos déjà faites",
  "Lire les catalogues",
  "Fabriquer les photos et les logos",
  "Enregistrer les photos",
  "Enregistrer les promos",
  "Signaler la fin à l'appli",
  "Complete job",
];
const MOMENTS = [
  { enCours: null, nouvelle: null }, // en attente d'une machine GitHub
  { enCours: "Lire les catalogues", nouvelle: "Catalogue 3 sur 9 : Un automne en fête" },
  { enCours: "Fabriquer les photos et les logos", nouvelle: "Photos : 312 sur 1\u202f450 (12 nouvelles)" },
  { enCours: "fini", nouvelle: "Promos enregistrées" },
];

/**
 * Un GitHub simulé. Chaque passage demandé avance d'un moment à chaque `avancer()` (ou tout seul, à
 * chaque question de l'appli, avec `toutSeul`). `refus` : la clé est refusée.
 */
export async function simulerGitHub(contexte, { refus = false, toutSeul = false } = {}) {
  const lancements = [];
  const debut = new Date(Date.now() - 2 * 60_000).toISOString(); // lancé il y a 2 minutes
  const passages = [{ id: 1, moment: MOMENTS.length - 1 }];
  const dernier = () => passages[0];
  const etapes = () => {
    const { moment } = dernier();
    const rangEnCours = MOMENTS[moment].enCours === "fini" ? ETAPES.length : ETAPES.indexOf(MOMENTS[moment].enCours);
    if (rangEnCours === -1) return [];
    return ETAPES.map((name, rang) => ({
      name,
      status: rang < rangEnCours ? "completed" : rang === rangEnCours ? "in_progress" : "queued",
      conclusion: rang < rangEnCours ? "success" : null,
      started_at: rang <= rangEnCours ? new Date(Date.parse(debut) + rang * 10_000).toISOString() : null,
      completed_at: rang < rangEnCours ? new Date(Date.parse(debut) + rang * 10_000 + 9_000).toISOString() : null,
    }));
  };

  await contexte.route(`${API}/**`, async (requete) => {
    const demande = requete.request();
    if (demande.method() === "OPTIONS") return requete.fulfill({ status: 204, headers: CORS });
    if (refus) return requete.fulfill({ status: 401, headers: CORS, json: { message: "Bad credentials" } });
    const chemin = new URL(demande.url()).pathname.replace(`/repos/LASCAMPIA67/promos-courses`, "");
    const reponse = (json) => requete.fulfill({ headers: CORS, json });
    if (chemin === "/actions/workflows/robot.yml/dispatches") {
      lancements.push({ cle: demande.headers().authorization, corps: demande.postDataJSON() });
      passages.unshift({ id: dernier().id + 1, moment: 0 });
      return requete.fulfill({ status: 204, headers: CORS });
    }
    if (chemin === "/actions/workflows/robot.yml/runs") {
      if (toutSeul && dernier().moment < MOMENTS.length - 1) dernier().moment += 1;
      const fini = dernier().moment === MOMENTS.length - 1;
      return reponse({
        workflow_runs: [
          {
            id: dernier().id,
            status: fini ? "completed" : dernier().moment === 0 ? "queued" : "in_progress",
            conclusion: fini ? "success" : null,
            created_at: debut,
            run_started_at: debut,
            updated_at: new Date(Date.parse(debut) + 4 * 60_000).toISOString(),
            html_url: `https://github.com/LASCAMPIA67/promos-courses/actions/runs/${dernier().id}`,
            head_sha: "abc123",
          },
        ],
      });
    }
    if (chemin === `/actions/runs/${dernier().id}/jobs`) return reponse({ jobs: [{ steps: etapes() }] });
    if (chemin === "/commits/abc123/statuses") {
      const { nouvelle } = MOMENTS[dernier().moment];
      const statut = { context: "robot-promos/avancee", description: nouvelle, created_at: new Date().toISOString() };
      return reponse(nouvelle ? [statut] : []);
    }
    return requete.fulfill({ status: 404, headers: CORS, json: {} });
  });
  return {
    lancements,
    avancer: () => {
      dernier().moment += 1;
    },
  };
}
