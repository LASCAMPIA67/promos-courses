// Le robot des promos lancé depuis l'appli (« Mettre à jour les promos »), avec l'API de GitHub :
// https://docs.github.com/fr/rest/actions/workflows.
//
// Il faut une clé GitHub du foyer, limitée à ce dépôt et au lancement des robots (« Actions ») ; elle
// est gardée dans Firebase (réglage « robot »), jamais dans ce dépôt public. Voir docs/appli.md.

export const DEPOT = "LASCAMPIA67/promos-courses";
const API = `https://api.github.com/repos/${DEPOT}`;
const ROBOT = `${API}/actions/workflows/robot.yml`;

/** La page de GitHub qui crée la clé, déjà remplie : il reste à choisir le dépôt, puis à la copier. */
export const ADRESSE_NOUVELLE_CLE = `https://github.com/settings/personal-access-tokens/new?${new URLSearchParams({
  name: "Bouton robot promos",
  description: "Lancer le robot des promos depuis l'appli (Mettre à jour les promos).",
  target_name: "LASCAMPIA67",
  expires_in: "366",
  actions: "write",
})}`;

/** Une clé GitHub « fine-grained » : « github_pat_ » suivi de lettres, chiffres et « _ ». */
export const cleValide = (cle) => /^github_pat_\w{20,250}$/.test(String(cle ?? "").trim());

/** Une erreur expliquée en clair ; `raison` : « cle » (à refaire), « reseau » ou « github ». */
export class ErreurRobot extends Error {
  constructor(raison, message) {
    super(message);
    this.name = "ErreurRobot";
    this.raison = raison;
  }
}

async function appeler(cle, adresse, { methode = "GET", corps, accepte = "application/vnd.github+json" } = {}, appel) {
  let reponse;
  try {
    reponse = await appel(adresse, {
      method: methode,
      headers: {
        Accept: accepte,
        Authorization: `Bearer ${cle}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(corps ? { "Content-Type": "application/json" } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ErreurRobot("reseau", "Pas de réseau : réessayez dans un moment.");
  }
  if (reponse.status === 401) throw new ErreurRobot("cle", "Clé GitHub refusée ou expirée : collez-en une nouvelle.");
  if (reponse.status === 403 || reponse.status === 404) {
    throw new ErreurRobot("cle", "Cette clé ne peut pas lancer le robot : refaites-la en choisissant promos-courses.");
  }
  if (!reponse.ok) throw new ErreurRobot("github", `GitHub ne répond pas (erreur ${reponse.status}) : réessayez.`);
  return reponse;
}

/** Lance le robot (comme « Run workflow » sur GitHub). */
export async function lancerRobot(cle, appel = fetch) {
  await appeler(cle, `${ROBOT}/dispatches`, { methode: "POST", corps: { ref: "main" } }, appel);
}

/** Un passage du robot, en clair : { id, etat (« en_cours », « reussi » ou « echoue »), debut, fin, adresse }. */
export function lirePassage(passage) {
  const etat = passage.status !== "completed" ? "en_cours" : passage.conclusion === "success" ? "reussi" : "echoue";
  return {
    id: passage.id,
    etat,
    debut: new Date(passage.run_started_at ?? passage.created_at),
    fin: new Date(passage.updated_at),
    adresse: passage.html_url,
    sha: passage.head_sha,
  };
}

/** Le dernier passage du robot (ou null s'il n'est jamais passé). */
export async function dernierPassage(cle, appel = fetch) {
  const reponse = await appeler(cle, `${ROBOT}/runs?per_page=1`, {}, appel);
  const [passage] = (await reponse.json()).workflow_runs ?? [];
  return passage ? lirePassage(passage) : null;
}

/**
 * L'adresse de promos.json tel que le robot vient de l'écrire : celle de son dernier enregistrement,
 * car GitHub sert l'adresse habituelle depuis une copie qui peut avoir jusqu'à 5 minutes de retard.
 */
export async function adressePromosFraiches(cle, appel = fetch) {
  const reponse = await appeler(cle, `${API}/commits/main`, { accepte: "application/vnd.github.sha" }, appel);
  const enregistrement = (await reponse.text()).trim();
  if (!/^[0-9a-f]{40}$/.test(enregistrement)) throw new ErreurRobot("github", "Réponse inattendue de GitHub.");
  return `https://raw.githubusercontent.com/${DEPOT}/${enregistrement}/promos.json`;
}

/**
 * Les grandes étapes d'un passage, comme l'appli les montre, et les étapes du robot sur GitHub qui
 * les composent : leurs noms exacts dans .github/workflows/robot.yml (un test vérifie qu'ils y sont).
 * GitHub ajoute « Set up job » au début, puis « Post … » et « Complete job » à la fin.
 */
export const PHASES = [
  {
    titre: "Démarrage",
    etapes: [
      "Set up job",
      "Vérifier si le robot est déjà passé aujourd'hui",
      "Récupérer le dépôt",
      "Installer Python",
      "Installer le robot",
      "Reprendre les photos déjà faites",
    ],
  },
  { titre: "Lecture des catalogues Leclerc", etapes: ["Lire les catalogues"] },
  { titre: "Photos des produits", etapes: ["Fabriquer les photos"] },
  {
    titre: "Enregistrement",
    etapes: ["Enregistrer les photos", "Enregistrer les promos", "Signaler la fin à l'appli"],
  },
];

/** Le nom du statut où le robot écrit où il en est (src/robot_promos/avancee.py). */
const CONTEXTE_AVANCEE = "robot-promos/avancee";

/**
 * Le détail d'un passage : les étapes de GitHub et la dernière nouvelle du robot (« Photos : 312
 * sur 1 450 »), ou null. Renvoie { etapes, nouvelle }.
 */
export async function detailsDuPassage(cle, passage, appel = fetch) {
  const [travaux, statuts] = await Promise.all([
    appeler(cle, `${API}/actions/runs/${passage.id}/jobs`, {}, appel).then((reponse) => reponse.json()),
    passage.sha
      ? appeler(cle, `${API}/commits/${passage.sha}/statuses?per_page=30`, {}, appel)
          .then((reponse) => reponse.json())
          .catch(() => [])
      : [],
  ]);
  // Les nouvelles de ce passage seulement (un passage précédent a pu écrire sur le même enregistrement).
  const nouvelle = (Array.isArray(statuts) ? statuts : []).find(
    (statut) => statut.context === CONTEXTE_AVANCEE && new Date(statut.created_at) >= passage.debut - 60_000,
  );
  return { etapes: travaux.jobs?.[0]?.steps ?? [], nouvelle: nouvelle?.description ?? null };
}

/**
 * Où en est un passage, étape par étape : [{ titre, etat (« fait », « en_cours », « a_venir » ou
 * « echoue »), duree (en millisecondes, ou null), detail (ou null) }].
 */
export function avanceeDuPassage(passage, { etapes = [], nouvelle = null } = {}, maintenant = new Date()) {
  const groupes = PHASES.map(() => []);
  let rang = 0;
  for (const etape of etapes) {
    const trouve = PHASES.findIndex((phase) => phase.etapes.includes(etape.name));
    if (trouve !== -1) rang = trouve;
    else if (/^(Post |Complete job)/.test(etape.name)) rang = PHASES.length - 1;
    groupes[rang].push(etape);
  }
  const finie = (etape) => etape.status === "completed";
  const phases = PHASES.map(({ titre }, n) => {
    const groupe = groupes[n];
    let etat = "a_venir";
    if (groupe.some((etape) => etape.conclusion === "failure")) etat = "echoue";
    else if (passage.etat === "reussi" || (groupe.length && groupe.every(finie))) etat = "fait";
    else if (groupe.some((etape) => etape.status === "in_progress" || finie(etape))) etat = "en_cours";
    const debuts = groupe.map((etape) => etape.started_at).filter(Boolean);
    const fins = groupe.map((etape) => etape.completed_at).filter(Boolean);
    const debut = debuts.length ? new Date(debuts.sort()[0]) : null;
    const fin = etat === "fait" && fins.length ? new Date(fins.sort().at(-1)) : maintenant;
    return { titre, etat, duree: debut ? Math.max(0, fin - debut) : null, detail: null };
  });
  if (passage.etat === "en_cours") {
    // Entre deux étapes, ou avant que GitHub ait trouvé une machine : la prochaine étape est « en cours ».
    if (!phases.some((phase) => phase.etat === "en_cours" || phase.etat === "echoue")) {
      const prochaine = phases.find((phase) => phase.etat === "a_venir");
      if (prochaine) prochaine.etat = "en_cours";
    }
    const enCours = phases.find((phase) => phase.etat === "en_cours");
    if (enCours) enCours.detail = etapes.length ? nouvelle : "En attente d'une machine GitHub…";
  }
  if (passage.etat === "echoue" && !phases.some((phase) => phase.etat === "echoue")) {
    const coupee = phases.find((phase) => phase.etat !== "fait");
    if (coupee) coupee.etat = "echoue";
  }
  return phases;
}

/** « 45 s », « 4 min », « 1 h 05 ». */
export function formaterDuree(millisecondes) {
  const secondes = Math.round(millisecondes / 1000);
  if (secondes < 60) return `${secondes} s`;
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}
