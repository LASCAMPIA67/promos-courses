// L'appli : connexion, puis liste de courses commune synchronisée entre nos deux iPhones,
// comparée aux promos de nos magasins.

import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { registerSW } from "virtual:pwa-register";

import { messageErreur, pluriel, preparerSaisie, trierArticles, trouverDoublon } from "./articles.js";
import { auth, db } from "./firebase.js";
import { proposerInstallation } from "./installation.js";
import { ajouterArticle, cocherArticle, modifierArticle, supprimerArticle, suivreArticles, viderLeCaddie } from "./liste.js";
import {
  URL_PROMOS,
  articleDepuisPromo,
  chercherPromos,
  dateDuJour,
  enseigne,
  formaterPrix,
  indexerPromos,
  infosPromo,
  joliNom,
  periode,
  phraseSource,
  phrasesFraicheur,
  rechercherPromos,
  resumePromos,
  sourcesEnDifficulte,
} from "./promos.js";

const $ = (id) => document.getElementById(id);

// Pour les tests, les promos viennent d'un fichier d'exemple au lieu du vrai promos.json.
const ADRESSE_PROMOS = import.meta.env.MODE === "emulateurs" ? "promos-test.json" : URL_PROMOS;
const RELIRE_LES_PROMOS_APRES = 60 * 60 * 1000; // 1 heure
const PROMOS_PAR_PAGE = 30;

const etat = {
  utilisateur: null,
  articles: [],
  arreterSuivi: null,
  articleOuvert: null,
  promos: null, // { donnees, index, luesLe }
  promosIndisponibles: false,
  vue: "liste", // onglet affiché : « liste » ou « promos »
  recherche: { texte: "", magasin: "", nombre: PROMOS_PAR_PAGE },
};

auth.languageCode = "fr";
$("version").textContent = __VERSION__;

// ---------------------------------------------------------------------------------------------
// Écrans

function afficherEcran(id) {
  for (const ecran of ["chargement", "connexion", "appli"]) $(ecran).hidden = ecran !== id;
}

function afficherMessage(element, texte, genre = "info") {
  element.textContent = texte ?? "";
  element.hidden = !texte;
  element.dataset.genre = genre;
}

onAuthStateChanged(auth, (utilisateur) => {
  etat.utilisateur = utilisateur;
  etat.arreterSuivi?.();
  etat.arreterSuivi = null;
  etat.articles = [];
  if (!utilisateur) {
    afficherVue("liste");
    afficherEcran("connexion");
    return;
  }
  $("email-compte").textContent = utilisateur.email ?? "";
  afficherEcran("appli");
  dessinerListe();
  etat.arreterSuivi = suivreArticles(
    db,
    (articles, { depuisLeTelephone }) => {
      etat.articles = articles;
      dessinerListe();
      mettreAJourBoutonsAjout();
      mettreAJourBandeau(depuisLeTelephone);
    },
    signalerErreur,
  );
});

// ---------------------------------------------------------------------------------------------
// Connexion

$("form-connexion").addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const bouton = evenement.submitter;
  bouton.disabled = true;
  afficherMessage($("message-connexion"), "");
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("mot-de-passe").value);
    $("mot-de-passe").value = "";
  } catch (erreur) {
    afficherMessage($("message-connexion"), messageErreur(erreur), "erreur");
  } finally {
    bouton.disabled = false;
  }
});

$("mot-de-passe-oublie").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!email) {
    afficherMessage($("message-connexion"), "Écrivez d'abord votre e-mail ci-dessus.", "erreur");
    $("email").focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    afficherMessage(
      $("message-connexion"),
      "Si un compte existe pour cette adresse, un e-mail pour changer le mot de passe vient d'être envoyé.",
      "succes",
    );
  } catch (erreur) {
    afficherMessage($("message-connexion"), messageErreur(erreur), "erreur");
  }
});

// ---------------------------------------------------------------------------------------------
// La liste

function dessinerListe() {
  const { aAcheter, dansLeCaddie } = trierArticles(etat.articles);
  const aujourdhui = dateDuJour();
  const promos = new Map(aAcheter.map((a) => [a.id, chercherPromos(etat.promos?.index, a.nom, aujourdhui)]));
  $("liste-a-acheter").replaceChildren(...aAcheter.map((a) => ligneArticle(a, promos.get(a.id))));
  $("liste-caddie").replaceChildren(...dansLeCaddie.map((a) => ligneArticle(a)));
  $("liste-vide").hidden = aAcheter.length > 0;
  $("section-caddie").hidden = dansLeCaddie.length === 0;
  $("titre-caddie").textContent = `Dans le caddie (${dansLeCaddie.length})`;
  const enPromo = [...promos.values()].filter((p) => p.length > 0).length;
  $("resume").textContent = aAcheter.length
    ? `${pluriel(aAcheter.length, "article")} à acheter${enPromo ? ` · ${enPromo} en promo` : ""}`
    : "Rien à acheter";
  dessinerEtatPromos();
}

function ligneArticle(article, promos = []) {
  const ligne = document.createElement("li");
  ligne.className = "article";
  ligne.dataset.id = article.id;
  ligne.classList.toggle("achete", article.achete);
  ligne.classList.toggle("en-attente", article.enAttente);

  const caseACocher = document.createElement("button");
  caseACocher.type = "button";
  caseACocher.className = "case";
  caseACocher.setAttribute("role", "checkbox");
  caseACocher.setAttribute("aria-checked", String(article.achete));
  caseACocher.setAttribute("aria-label", `${article.nom} : ${article.achete ? "dans le caddie" : "à acheter"}`);
  caseACocher.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>';
  caseACocher.addEventListener("click", () => {
    cocherArticle(db, article).catch(signalerErreur);
  });

  const contenu = document.createElement("button");
  contenu.type = "button";
  contenu.className = "texte";
  contenu.setAttribute("aria-label", `Modifier ${article.nom}`);
  const nom = document.createElement("span");
  nom.className = "nom";
  nom.textContent = article.nom;
  contenu.append(nom);
  const details = [article.quantite, article.note].filter(Boolean).join(" · ");
  if (details) {
    const sousTitre = document.createElement("span");
    sousTitre.className = "details";
    sousTitre.textContent = details;
    contenu.append(sousTitre);
  }
  contenu.addEventListener("click", () => ouvrirArticle(article));

  ligne.append(caseACocher, contenu);
  if (promos.length) ligne.append(boutonPromos(article, promos));
  return ligne;
}

function boutonPromos(article, promos) {
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "bouton-promos";
  bouton.setAttribute("aria-label", `Voir ${pluriel(promos.length, "promo")} pour ${article.nom}`);
  const pastille = document.createElement("span");
  pastille.className = "pastille";
  pastille.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />' +
    '<circle cx="7.5" cy="7.5" r="1.2" /></svg>';
  pastille.append(pluriel(promos.length, "promo"));
  bouton.append(pastille);
  bouton.addEventListener("click", () => ouvrirPromos(article, promos));
  return bouton;
}

$("form-ajout").addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const { article, erreur } = preparerSaisie({ nom: $("ajout-nom").value, quantite: $("ajout-quantite").value });
  if (erreur) {
    afficherMessage($("message-ajout"), erreur, "erreur");
    return;
  }
  const doublon = trouverDoublon(etat.articles, article.nom);
  if (doublon) {
    afficherMessage($("message-ajout"), `« ${doublon.nom} » est déjà dans la liste.`, "info");
    surligner(doublon.id);
    return;
  }
  afficherMessage($("message-ajout"), "");
  // On n'attend pas la réponse du serveur : sans réseau, l'article est gardé et envoyé plus tard.
  ajouterArticle(db, etat.utilisateur.uid, article).catch(signalerErreur);
  $("ajout-nom").value = "";
  $("ajout-quantite").value = "";
  $("ajout-nom").focus();
});

$("ajout-nom").addEventListener("input", () => afficherMessage($("message-ajout"), ""));

function surligner(id) {
  const ligne = document.querySelector(`.article[data-id="${CSS.escape(id)}"]`);
  if (!ligne) return;
  ligne.scrollIntoView({ block: "nearest", behavior: "smooth" });
  ligne.classList.remove("surligne");
  void ligne.offsetWidth; // relance l'animation
  ligne.classList.add("surligne");
}

$("vider-caddie").addEventListener("click", async () => {
  const { dansLeCaddie } = trierArticles(etat.articles);
  if (await confirmer(`Retirer de la liste les ${pluriel(dansLeCaddie.length, "article")} du caddie ?`)) {
    viderLeCaddie(db, dansLeCaddie).catch(signalerErreur);
  }
});

// ---------------------------------------------------------------------------------------------
// Les promos

async function chargerPromos() {
  try {
    const reponse = await fetch(ADRESSE_PROMOS, { cache: "no-cache", signal: AbortSignal.timeout(20_000) });
    if (!reponse.ok) throw new Error(`promos.json : erreur ${reponse.status}`);
    const donnees = await reponse.json();
    etat.promos = { donnees, index: indexerPromos(donnees), luesLe: Date.now() };
    etat.promosIndisponibles = false;
  } catch (erreur) {
    console.warn("Promos indisponibles :", erreur);
    // Si on avait déjà des promos, on les garde.
    etat.promosIndisponibles = !etat.promos;
  }
  dessinerListe();
  if (etat.vue === "promos") dessinerRecherche();
}

function relirePromosSiBesoin() {
  if (document.visibilityState !== "visible") return;
  if (!etat.promos || Date.now() - etat.promos.luesLe > RELIRE_LES_PROMOS_APRES) chargerPromos();
}

/** Prévient si les promos manquent, sont anciennes ou incomplètes ; rappelle leur date en bas. */
function dessinerEtatPromos() {
  const alertes = [];
  let info = "";
  if (etat.promosIndisponibles) {
    alertes.push("Promos indisponibles pour le moment (pas de réseau ?). La liste, elle, marche normalement.");
  } else if (etat.promos) {
    const phrases = phrasesFraicheur(etat.promos.donnees.mise_a_jour);
    info = phrases.info;
    if (phrases.alerte) alertes.push(phrases.alerte);
    alertes.push(...sourcesEnDifficulte(etat.promos.donnees).map(phraseSource));
  }
  afficherMessage($("etat-promos"), alertes.join(" "), "attention");
  $("info-promos").textContent = info;
}

function ouvrirPromos(article, promos) {
  const aujourdhui = dateDuJour();
  $("titre-fenetre-promos").textContent = `Promos pour « ${article.nom} »`;
  $("resume-promos").textContent = resumePromos(promos);
  $("liste-promos").replaceChildren(...promos.map(({ offre, aVenir }) => cartePromo(offre, aVenir, aujourdhui)));
  $("fenetre-promos").showModal();
  $("liste-promos").scrollTop = 0;
}

function element(balise, classe, texte) {
  const el = document.createElement(balise);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

function cartePromo(offre, aVenir, aujourdhui, { avecAjout = false } = {}) {
  const carte = element("li", "promo");
  carte.toggleAttribute("data-a-venir", aVenir);

  const haut = element("div", "promo-haut");
  const magasin = element("span", "enseigne", enseigne(offre));
  magasin.dataset.source = offre.source;
  haut.append(magasin, element("span", "periode", periode(offre, aujourdhui)));
  carte.append(haut, element("p", "promo-nom", joliNom(offre.produit)));
  if (offre.marque) carte.append(element("p", "promo-marque", offre.marque));
  if (offre.description) carte.append(element("p", "promo-description", offre.description));

  const prix = element("p", "promo-prix");
  if (offre.prix != null) prix.append(element("strong", "prix", formaterPrix(offre.prix)));
  if (offre.ancien_prix != null) {
    prix.append(element("span", "cache", " au lieu de "), element("s", "ancien-prix", formaterPrix(offre.ancien_prix)));
  }
  if (offre.reduction) prix.append(element("span", "reduction", offre.reduction));
  if (prix.childElementCount) carte.append(prix);

  const infos = infosPromo(offre);
  if (infos.length) carte.append(element("p", "promo-infos", infos.join(" · ")));

  const actions = element("div", "promo-actions");
  if (avecAjout) actions.append(boutonAjouter(offre, aujourdhui));
  if (/^https:\/\//.test(offre.lien ?? "")) {
    const lien = element("a", "lien-catalogue", "Voir dans le catalogue");
    lien.href = offre.lien;
    lien.target = "_blank";
    lien.rel = "noopener noreferrer";
    actions.append(lien);
  }
  if (actions.childElementCount) carte.append(actions);
  return carte;
}

// ---------------------------------------------------------------------------------------------
// Onglet « Promos » : chercher dans toutes les promos et les ajouter à la liste

function afficherVue(vue) {
  etat.vue = vue;
  $("vue-liste").hidden = vue !== "liste";
  $("vue-promos").hidden = vue !== "promos";
  for (const onglet of document.querySelectorAll(".onglet")) {
    if (onglet.dataset.vue === vue) onglet.setAttribute("aria-current", "page");
    else onglet.removeAttribute("aria-current");
  }
  window.scrollTo(0, 0);
  if (vue === "promos") dessinerRecherche();
}

for (const onglet of document.querySelectorAll(".onglet")) {
  onglet.addEventListener("click", () => afficherVue(onglet.dataset.vue));
}

function dessinerRecherche() {
  const { texte, magasin, nombre } = etat.recherche;
  const index = etat.promos?.index;
  $("plus-de-resultats").hidden = true;
  if (!index) {
    $("resume-catalogue").textContent = "";
    $("etat-recherche").textContent = etat.promosIndisponibles
      ? "Promos indisponibles pour le moment (pas de réseau ?)."
      : "Chargement des promos…";
    $("resultats").replaceChildren();
    return;
  }
  const aujourdhui = dateDuJour();
  const total = rechercherPromos(index, "", aujourdhui).length;
  $("resume-catalogue").textContent = `${total.toLocaleString("fr-FR")} promos chez Lidl et Leclerc`;

  const resultats = rechercherPromos(index, texte, aujourdhui, { magasin });
  const chez = magasin ? ` chez ${magasin === "lidl" ? "Lidl" : "Leclerc"}` : "";
  const n = resultats.length;
  if (!texte.trim()) {
    $("etat-recherche").textContent = `${n.toLocaleString("fr-FR")} promos en cours et à venir${chez}.`;
  } else if (n === 0) {
    $("etat-recherche").textContent = `Aucune promo pour « ${texte.trim()} »${chez}.`;
  } else {
    $("etat-recherche").textContent = `${n} promo${n > 1 ? "s" : ""} trouvée${n > 1 ? "s" : ""}${chez}.`;
  }
  $("resultats").replaceChildren(
    ...resultats.slice(0, nombre).map(({ offre, aVenir }) => cartePromo(offre, aVenir, aujourdhui, { avecAjout: true })),
  );
  $("plus-de-resultats").hidden = n <= nombre;
}

let attenteRecherche;
$("recherche").addEventListener("input", () => {
  clearTimeout(attenteRecherche);
  attenteRecherche = setTimeout(() => {
    etat.recherche.texte = $("recherche").value;
    etat.recherche.nombre = PROMOS_PAR_PAGE;
    dessinerRecherche();
  }, 150);
});

$("form-recherche").addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  $("recherche").blur(); // range le clavier pour voir les résultats
});

for (const filtre of document.querySelectorAll(".filtre")) {
  filtre.addEventListener("click", () => {
    etat.recherche.magasin = filtre.dataset.magasin;
    etat.recherche.nombre = PROMOS_PAR_PAGE;
    for (const autre of document.querySelectorAll(".filtre")) autre.setAttribute("aria-pressed", String(autre === filtre));
    dessinerRecherche();
  });
}

$("plus-de-resultats").addEventListener("click", () => {
  etat.recherche.nombre += PROMOS_PAR_PAGE;
  dessinerRecherche();
});

/** « Ajouter à la liste », ou « Dans la liste » si l'article y est déjà. */
function boutonAjouter(offre, aujourdhui) {
  const bouton = element("button", "bouton-ajouter");
  bouton.type = "button";
  bouton.dataset.nom = articleDepuisPromo(offre, aujourdhui).nom;
  mettreAJourBoutonAjout(bouton);
  bouton.addEventListener("click", () => {
    const { article, erreur } = preparerSaisie(articleDepuisPromo(offre, dateDuJour()));
    if (erreur) return;
    // Comme pour l'ajout dans la liste : sans réseau, l'article part plus tard.
    ajouterArticle(db, etat.utilisateur.uid, article).catch(signalerErreur);
    bouton.disabled = true;
    bouton.textContent = "✓ Ajouté à la liste";
  });
  return bouton;
}

function mettreAJourBoutonAjout(bouton) {
  const nom = bouton.dataset.nom;
  const dejaDansLaListe = Boolean(trouverDoublon(etat.articles, nom));
  bouton.disabled = dejaDansLaListe;
  bouton.textContent = dejaDansLaListe ? "✓ Dans la liste" : "+ Ajouter à la liste";
  bouton.setAttribute("aria-label", dejaDansLaListe ? `${nom} : déjà dans la liste` : `Ajouter ${nom} à la liste`);
}

function mettreAJourBoutonsAjout() {
  for (const bouton of document.querySelectorAll("#resultats .bouton-ajouter")) mettreAJourBoutonAjout(bouton);
}

chargerPromos();
document.addEventListener("visibilitychange", relirePromosSiBesoin);
window.addEventListener("online", () => {
  if (etat.promosIndisponibles) chargerPromos();
});

// ---------------------------------------------------------------------------------------------
// Installation sur l'iPhone et mises à jour

const CLE_CONSEIL = "conseil-installation-ferme-le";
const appliInstallee = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;

// La mémoire du navigateur peut être refusée (navigation privée) : ce n'est pas grave ici.
function lireMemoire(cle) {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireMemoire(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // tant pis : le conseil reviendra
  }
}

function dessinerConseilInstallation() {
  $("conseil-installation").hidden = !proposerInstallation({
    userAgent: navigator.userAgent,
    pointsDeContact: navigator.maxTouchPoints,
    installee: appliInstallee,
    fermeLe: Number(lireMemoire(CLE_CONSEIL)) || null,
  });
}

$("fermer-conseil").addEventListener("click", () => {
  ecrireMemoire(CLE_CONSEIL, String(Date.now()));
  dessinerConseilInstallation();
});
dessinerConseilInstallation();

/** Quelqu'un est en train d'écrire ou a une fenêtre ouverte : ce n'est pas le moment de recharger. */
function saisieEnCours() {
  if (document.querySelector("dialog[open]")) return true;
  return [...document.querySelectorAll("input, textarea")].some((champ) => champ.value.trim());
}

// Une nouvelle version publiée est prise toute seule. L'appli installée reste souvent ouverte en
// arrière-plan pendant des jours : elle vérifie donc à chaque retour au premier plan.
registerSW({
  immediate: true,
  onRegisteredSW(_adresse, enregistrement) {
    if (!enregistrement) return;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") enregistrement.update().catch(() => {});
    });
  },
  onNeedReload() {
    if (!saisieEnCours()) {
      window.location.reload();
      return;
    }
    // On ne recharge pas sous les doigts de quelqu'un : on attend que l'appli passe en arrière-plan.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") window.location.reload();
    });
  },
});

// ---------------------------------------------------------------------------------------------
// Modifier ou supprimer un article

function ouvrirArticle(article) {
  etat.articleOuvert = article;
  $("modif-nom").value = article.nom;
  $("modif-quantite").value = article.quantite ?? "";
  $("modif-note").value = article.note ?? "";
  afficherMessage($("message-article"), "");
  $("fenetre-article").showModal();
}

$("form-article").addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const { article, erreur } = preparerSaisie({
    nom: $("modif-nom").value,
    quantite: $("modif-quantite").value,
    note: $("modif-note").value,
  });
  if (erreur) {
    afficherMessage($("message-article"), erreur, "erreur");
    return;
  }
  const doublon = !etat.articleOuvert.achete && trouverDoublon(etat.articles, article.nom, etat.articleOuvert.id);
  if (doublon) {
    afficherMessage($("message-article"), `« ${doublon.nom} » est déjà dans la liste.`, "erreur");
    return;
  }
  modifierArticle(db, etat.articleOuvert.id, article).catch(signalerErreur);
  $("fenetre-article").close();
});

$("supprimer-article").addEventListener("click", async () => {
  const article = etat.articleOuvert;
  $("fenetre-article").close();
  if (await confirmer(`Supprimer « ${article.nom} » de la liste ?`)) {
    supprimerArticle(db, article.id).catch(signalerErreur);
  }
});

// ---------------------------------------------------------------------------------------------
// Compte, confirmations, état du réseau

$("bouton-compte").addEventListener("click", () => $("fenetre-compte").showModal());

$("deconnexion").addEventListener("click", async () => {
  $("fenetre-compte").close();
  await signOut(auth);
});

for (const bouton of document.querySelectorAll("[data-fermer]")) {
  bouton.addEventListener("click", () => bouton.closest("dialog").close());
}

// Un appui en dehors d'une fenêtre la ferme.
for (const fenetre of document.querySelectorAll("dialog")) {
  fenetre.addEventListener("click", (evenement) => {
    if (evenement.target === fenetre) fenetre.close();
  });
}

function confirmer(texte) {
  const fenetre = $("fenetre-confirmation");
  $("texte-confirmation").textContent = texte;
  fenetre.returnValue = "";
  fenetre.showModal();
  return new Promise((resoudre) => {
    $("confirmer").onclick = () => fenetre.close("oui");
    fenetre.addEventListener("close", () => resoudre(fenetre.returnValue === "oui"), { once: true });
  });
}

function signalerErreur(erreur) {
  console.error(erreur);
  const texte = messageErreur(erreur);
  afficherMessage($("bandeau"), texte, "erreur");
  // Un problème passager disparaît tout seul ; un refus d'accès reste affiché.
  if (erreur?.code !== "permission-denied") {
    setTimeout(() => {
      if ($("bandeau").textContent === texte) afficherMessage($("bandeau"), "");
    }, 6000);
  }
}

function mettreAJourBandeau(depuisLeTelephone = false) {
  const bandeau = $("bandeau");
  if (bandeau.dataset.genre === "erreur" && !bandeau.hidden) return;
  if (!navigator.onLine) {
    afficherMessage(bandeau, "Hors connexion : vos changements seront envoyés dès le retour du réseau.", "hors-ligne");
  } else if (depuisLeTelephone && etat.articles.some((a) => a.enAttente)) {
    afficherMessage(bandeau, "Synchronisation en cours…", "info");
  } else {
    afficherMessage(bandeau, "");
  }
}

window.addEventListener("online", () => mettreAJourBandeau());
window.addEventListener("offline", () => mettreAJourBandeau());
