// Règles simples sur les articles de la liste (sans Firebase : faciles à tester).

export const LONGUEURS = { nom: 100, quantite: 30, note: 200, promo: 100 };

/** Enlève les espaces en trop : « ␣ lait   demi ␣ » → « lait demi ». */
export function nettoyer(texte) {
  return String(texte ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Forme simplifiée d'un nom, pour repérer les doublons : « Lait demi-écrémé » → « lait demi ecreme ». */
export function cle(nom) {
  return nettoyer(nom)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Prépare un article saisi : textes nettoyés, champs vides retirés.
 * Renvoie { article } si tout va bien, ou { erreur } avec un message en français.
 */
export function preparerSaisie({ nom, quantite = "", note = "", promo = "" }) {
  const article = { nom: nettoyer(nom), quantite: nettoyer(quantite), note: nettoyer(note), promo: nettoyer(promo) };
  if (!article.nom) return { erreur: "Écrivez le nom de l'article." };
  for (const [champ, max] of Object.entries(LONGUEURS)) {
    if (article[champ].length > max) {
      return { erreur: `Le champ « ${champ} » est trop long (${max} caractères au maximum).` };
    }
  }
  for (const champ of ["quantite", "note", "promo"]) {
    if (!article[champ]) delete article[champ];
  }
  return { article };
}

/** Cherche un article encore à acheter qui porte (presque) le même nom. */
export function trouverDoublon(articles, nom, saufId = null) {
  const recherche = cle(nom);
  return articles.find((a) => !a.achete && a.id !== saufId && cle(a.nom) === recherche) ?? null;
}

function date(article) {
  return article.cree_le?.toMillis?.() ?? Number.MAX_SAFE_INTEGER; // pas encore enregistré : à la fin
}

/** Sépare la liste en « à acheter » (ordre d'ajout) et « dans le caddie » (dernier coché en haut). */
export function trierArticles(articles) {
  const aAcheter = articles.filter((a) => !a.achete).sort((a, b) => date(a) - date(b));
  const dansLeCaddie = articles
    .filter((a) => a.achete)
    .sort((a, b) => (b.modifie_le?.toMillis?.() ?? 0) - (a.modifie_le?.toMillis?.() ?? 0));
  return { aAcheter, dansLeCaddie };
}

/** « 1 article », « 3 articles ». */
export function pluriel(nombre, mot) {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}

const MESSAGES = {
  "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
  "auth/invalid-login-credentials": "E-mail ou mot de passe incorrect.",
  "auth/wrong-password": "E-mail ou mot de passe incorrect.",
  "auth/user-not-found": "E-mail ou mot de passe incorrect.",
  "auth/invalid-email": "Cette adresse e-mail n'est pas valide.",
  "auth/missing-password": "Écrivez votre mot de passe.",
  "auth/user-disabled": "Ce compte a été désactivé.",
  "auth/too-many-requests": "Trop d'essais. Patientez quelques minutes avant de réessayer.",
  "auth/network-request-failed": "Pas de connexion internet. Réessayez quand le réseau revient.",
  "permission-denied": "Ce compte n'a pas accès à la liste de courses.",
  unavailable: "Le service est momentanément injoignable. Vos changements seront envoyés plus tard.",
};

/** Traduit une erreur Firebase en message clair. */
export function messageErreur(erreur) {
  const code = String(erreur?.code ?? "").replace(/^firestore\//, "");
  return MESSAGES[code] ?? "Une erreur inattendue est survenue. Réessayez.";
}
