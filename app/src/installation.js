// L'appli installée sur l'écran d'accueil de l'iPhone : conseil d'installation et mises à jour.

/** Après « Plus tard », le conseil d'installation revient au bout de ce délai. */
export const JOURS_AVANT_DE_REPROPOSER = 14;

/** iPhone ou iPad (les iPad récents se présentent comme un Mac, mais ont un écran tactile). */
export function estUnAppareilApple(userAgent, pointsDeContact = 0) {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && pointsDeContact > 1);
}

/**
 * Faut-il proposer d'installer l'appli ? Oui sur iPhone ou iPad, dans Safari (pas déjà ouverte
 * depuis l'écran d'accueil), sauf si on a répondu « Plus tard » il y a peu.
 */
export function proposerInstallation({ userAgent, pointsDeContact = 0, installee, fermeLe = null, maintenant = Date.now() }) {
  if (installee || !estUnAppareilApple(userAgent, pointsDeContact)) return false;
  return !fermeLe || maintenant - fermeLe > JOURS_AVANT_DE_REPROPOSER * 24 * 3_600_000;
}
