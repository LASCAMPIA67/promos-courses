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

/** « Le robot travaille depuis 4 min… », pour suivre un passage. */
export function phrasePassage(passage, maintenant = new Date()) {
  if (passage.etat === "en_cours") {
    const minutes = Math.floor((maintenant - passage.debut) / 60_000);
    return minutes < 1 ? "Le robot démarre…" : `Le robot travaille depuis ${minutes} min…`;
  }
  return passage.etat === "reussi" ? "Promos à jour." : "Le robot n'a pas réussi à mettre les promos à jour.";
}
