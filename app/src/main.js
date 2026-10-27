// L'appli : connexion, puis liste de courses commune synchronisée entre nos deux iPhones,
// comparée aux promos de nos magasins.

import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { registerSW } from "virtual:pwa-register";

import { messageErreur, pluriel, preparerSaisie, trierArticles, trouverDoublon } from "./articles.js";
import { auth, db } from "./firebase.js";
import { proposerInstallation } from "./installation.js";
import {
  ajouterArticle,
  cocherArticle,
  enregistrerMembre,
  modifierArticle,
  suivreArticles,
  suivreMembres,
  supprimerArticle,
  viderLeCaddie,
} from "./liste.js";
import { couleurDe, formaterAjout, nomDe, preparerFiche } from "./membres.js";
import {
  URL_PROMOS,
  articleDepuisPromo,
  chercherPromos,
  dateDuJour,
  enseigne,
  explicationPrix,
  indexerPromos,
  joliNom,
  periode,
  phraseSource,
  phrasesFraicheur,
  rechercherPromos,
  resumeDescription,
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
  membres: {}, // { uid: { prenom, couleur } } : qui est qui, pour les pastilles de couleur
  arreterMembres: null,
  articleOuvert: null,
  ligneOuverte: null, // article dont le bouton « Supprimer » est visible (glissé vers la gauche)
  promos: null, // { donnees, index, luesLe }
  promosIndisponibles: false,
  recherche: { texte: "", nombre: PROMOS_PAR_PAGE }, // promos trouvées pendant qu'on écrit
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
  etat.arreterMembres?.();
  etat.arreterSuivi = null;
  etat.arreterMembres = null;
  etat.articles = [];
  etat.membres = {};
  if (!utilisateur) {
    $("ajout-nom").value = "";
    dessinerSuggestions();
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
  etat.arreterMembres = suivreMembres(
    db,
    (membres) => {
      etat.membres = membres;
      dessinerListe();
      dessinerLegende();
    },
    // Sans les fiches (règles pas encore publiées, réseau…), les pastilles prennent une couleur d'office.
    (erreur) => console.warn("Fiches des membres indisponibles :", erreur),
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
  // Un doigt est posé sur la liste (pour cocher ou glisser) : on redessine quand il se lève.
  if (doigtPose) {
    listeEnRetard = true;
    return;
  }
  const { aAcheter, dansLeCaddie } = trierArticles(etat.articles);
  const aujourdhui = dateDuJour();
  const promos = new Map(aAcheter.map((a) => [a.id, chercherPromos(etat.promos?.index, a.nom, aujourdhui)]));
  $("liste-a-acheter").replaceChildren(...aAcheter.map((a) => ligneArticle(a, promos.get(a.id))));
  $("liste-caddie").replaceChildren(...dansLeCaddie.map((a) => ligneArticle(a)));
  $("liste-vide").hidden = aAcheter.length > 0;
  $("section-caddie").hidden = dansLeCaddie.length === 0;
  $("titre-caddie").textContent = `Dans le caddie (${dansLeCaddie.length})`;
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

  // Le nom, la pastille de celui qui l'a ajouté, puis quand, la quantité et la note.
  const auteur = auteurDe(article);
  const contenu = document.createElement("button");
  contenu.type = "button";
  contenu.className = "texte";
  contenu.setAttribute(
    "aria-label",
    `Modifier ${article.nom}, ajouté par ${[auteur.nom, auteur.quand].filter(Boolean).join(" ")}`,
  );
  const nom = document.createElement("span");
  nom.className = "nom";
  nom.textContent = article.nom;
  nom.append(pastilleMembre(auteur.couleur));
  contenu.append(nom);
  const details = [auteur.quand, article.quantite, article.note].filter(Boolean).join(" · ");
  if (details) {
    const sousTitre = document.createElement("span");
    sousTitre.className = "details";
    sousTitre.textContent = details;
    contenu.append(sousTitre);
  }
  contenu.addEventListener("click", () => ouvrirArticle(article));

  // Devant : la ligne elle-même ; derrière : le bouton « Supprimer », qu'on découvre en glissant.
  const devant = document.createElement("div");
  devant.className = "article-devant";
  devant.append(caseACocher, contenu);
  if (promos.length) devant.append(boutonPromos(article, promos));

  const supprimer = document.createElement("button");
  supprimer.type = "button";
  supprimer.className = "supprimer-glisse";
  supprimer.textContent = "Supprimer";
  supprimer.setAttribute("aria-label", `Supprimer ${article.nom}`);
  supprimer.addEventListener("click", () => supprimerAvecAnnulation(article));

  ligne.append(supprimer, devant);
  montrerSupprimer(ligne, article.id === etat.ligneOuverte);
  rendreGlissable(ligne, devant);
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
  $("ajout-nom").value = "";
  $("ajout-quantite").value = "";
  dessinerSuggestions(); // la liste réapparaît
  if (doublon) {
    afficherMessage($("message-ajout"), `« ${doublon.nom} » est déjà dans la liste.`, "info");
    surligner(doublon.id);
    return;
  }
  afficherMessage($("message-ajout"), "");
  // On n'attend pas la réponse du serveur : sans réseau, l'article est gardé et envoyé plus tard.
  ajouterArticle(db, etat.utilisateur.uid, article).catch(signalerErreur);
  $("ajout-nom").focus();
});

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
  dessinerSuggestions();
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
    alertes.push("Promos indisponibles (pas de réseau ?).");
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

// Ce que dit l'encadré sous le prix, selon l'endroit où va la réduction (voir explicationPrix).
const TITRES_AVANTAGE = {
  caisse: "Réduction en caisse",
  lot: "En prenant plusieurs",
  "carte-caisse": "Avec la carte E.Leclerc",
  "carte-leclerc": "Sur la carte E.Leclerc",
  "lidl-plus": "Avec l'appli Lidl Plus",
};

function cartePromo(offre, aVenir, aujourdhui, { avecAjout = false } = {}) {
  const carte = element("li", "promo");
  carte.toggleAttribute("data-a-venir", aVenir);

  const haut = element("div", "promo-haut");
  const magasin = element("span", "enseigne", enseigne(offre));
  magasin.dataset.source = offre.source;
  haut.append(magasin, element("span", "periode", periode(offre, aujourdhui)));

  // Le nom, avec la marque si elle n'y est pas déjà.
  const nom = element("p", "promo-nom", joliNom(offre.produit));
  if (offre.marque && !joliNom(offre.produit).toLowerCase().includes(offre.marque.toLowerCase())) {
    nom.append(" ", element("span", "promo-marque", offre.marque));
  }
  carte.append(haut, nom);
  const description = resumeDescription(offre.description);
  if (description) carte.append(element("p", "promo-description", description));

  // Le prix, et en clair où va la réduction : en caisse, sur la carte E.Leclerc ou avec Lidl Plus.
  const explication = explicationPrix(offre);
  const prix = element("p", "promo-prix");
  if (explication.prix) prix.append(element("strong", "prix", explication.prix));
  if (explication.mention) prix.append(element("span", "mention", explication.mention));
  if (explication.barre) {
    prix.append(element("span", "cache", " au lieu de "), element("s", "ancien-prix", explication.barre));
  }
  if (explication.unitaire) prix.append(element("span", "prix-unitaire", explication.unitaire));
  if (prix.childElementCount) carte.append(prix);
  if (explication.avantage) {
    const avantage = element("p", "avantage");
    avantage.dataset.genre = explication.genre;
    avantage.append(
      element("strong", "avantage-titre", TITRES_AVANTAGE[explication.genre]),
      element("span", null, explication.avantage),
    );
    carte.append(avantage);
  }

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
// Pendant qu'on écrit un article : les promos qui correspondent, à ajouter d'un geste.
// « + » ou « OK » ajoute ce qui est écrit, qu'il y ait des promos ou non.

/** On cherche à partir de 2 lettres : une seule en trouverait presque partout. */
const LETTRES_MINIMUM = 2;

function dessinerSuggestions() {
  const texte = $("ajout-nom").value.trim();
  $("effacer-saisie").hidden = !texte;
  const index = etat.promos?.index;
  const actives = texte.length >= LETTRES_MINIMUM && Boolean(index);
  $("suggestions").hidden = !actives;
  $("contenu").hidden = actives; // la liste revient dès que le champ est vide
  if (!actives) return;

  if (texte !== etat.recherche.texte) etat.recherche = { texte, nombre: PROMOS_PAR_PAGE };
  const aujourdhui = dateDuJour();
  const resultats = rechercherPromos(index, texte, aujourdhui);
  const n = resultats.length;
  $("etat-recherche").textContent = n === 0 ? "Aucune promo · + pour l'ajouter" : pluriel(n, "promo");
  $("resultats").replaceChildren(
    ...resultats
      .slice(0, etat.recherche.nombre)
      .map(({ offre, aVenir }) => cartePromo(offre, aVenir, aujourdhui, { avecAjout: true })),
  );
  $("plus-de-resultats").hidden = n <= etat.recherche.nombre;
}

let attenteRecherche;
$("ajout-nom").addEventListener("input", () => {
  afficherMessage($("message-ajout"), "");
  $("effacer-saisie").hidden = !$("ajout-nom").value.trim();
  clearTimeout(attenteRecherche);
  attenteRecherche = setTimeout(dessinerSuggestions, 150);
});

function effacerSaisie() {
  $("ajout-nom").value = "";
  dessinerSuggestions();
  $("ajout-nom").focus();
}

$("effacer-saisie").addEventListener("click", effacerSaisie);
$("ajout-nom").addEventListener("keydown", (evenement) => {
  if (evenement.key === "Escape") effacerSaisie();
});

$("plus-de-resultats").addEventListener("click", () => {
  etat.recherche.nombre += PROMOS_PAR_PAGE;
  dessinerSuggestions();
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
// Qui a ajouté quel article, et quand

/** Les comptes connus : le mien, ceux qui ont une fiche et ceux qui ont ajouté un article. */
function uidsConnus() {
  return [
    ...new Set([etat.utilisateur?.uid, ...Object.keys(etat.membres), ...etat.articles.map((a) => a.ajoute_par)]),
  ].filter(Boolean);
}

function auteurDe(article) {
  const uid = article.ajoute_par;
  return {
    nom: nomDe(uid, etat.membres, etat.utilisateur?.uid),
    couleur: couleurDe(uid, etat.membres, uidsConnus()),
    quand: formaterAjout(article.cree_le?.toDate?.()),
  };
}

function pastilleMembre(couleur) {
  const pastille = document.createElement("span");
  pastille.className = "pastille-membre";
  pastille.dataset.couleur = couleur;
  pastille.setAttribute("aria-hidden", "true");
  return pastille;
}

// ---------------------------------------------------------------------------------------------
// Glisser un article vers la gauche pour le supprimer, comme dans Mail sur l'iPhone

const LARGEUR_SUPPRIMER = 88; // en pixels, comme dans style.css

// Pendant qu'un doigt est posé sur la liste, un changement venu de l'autre téléphone ne la redessine
// pas tout de suite : le geste en cours n'est pas interrompu.
let doigtPose = false;
let listeEnRetard = false;
document.addEventListener("pointerdown", (evenement) => {
  if (evenement.target.closest?.(".liste")) doigtPose = true;
});
for (const fin of ["pointerup", "pointercancel"]) {
  document.addEventListener(fin, () => {
    // Après les gestionnaires de la ligne, qui finissent le glissement.
    setTimeout(() => {
      doigtPose = false;
      if (listeEnRetard) {
        listeEnRetard = false;
        dessinerListe();
      }
    });
  });
}

function montrerSupprimer(ligne, visible) {
  ligne.classList.toggle("ouverte", visible);
  const bouton = ligne.querySelector(".supprimer-glisse");
  if (visible) bouton.removeAttribute("aria-hidden");
  else bouton.setAttribute("aria-hidden", "true");
  bouton.tabIndex = visible ? 0 : -1;
}

function fermerLignes() {
  for (const ligne of document.querySelectorAll(".article.ouverte")) montrerSupprimer(ligne, false);
  etat.ligneOuverte = null;
}

function rendreGlissable(ligne, devant) {
  let depart = null;
  let glisse = false;
  const decalage = (evenement) =>
    Math.max(
      -1.4 * LARGEUR_SUPPRIMER,
      Math.min(0, (depart.ouverte ? -LARGEUR_SUPPRIMER : 0) + evenement.clientX - depart.x),
    );

  devant.addEventListener("pointerdown", (evenement) => {
    if (evenement.button !== 0) return;
    depart = { x: evenement.clientX, y: evenement.clientY, ouverte: ligne.classList.contains("ouverte") };
    glisse = false;
  });

  devant.addEventListener("pointermove", (evenement) => {
    if (!depart) return;
    const dx = evenement.clientX - depart.x;
    const dy = evenement.clientY - depart.y;
    if (!glisse) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) depart = null; // on fait défiler la liste
      if (!depart || Math.abs(dx) < 10) return;
      glisse = true;
      devant.setPointerCapture(evenement.pointerId);
      ligne.classList.add("glisse");
    }
    devant.style.transform = `translateX(${decalage(evenement)}px)`;
  });

  const finir = (evenement) => {
    if (!depart) return;
    if (glisse) {
      const ouvrir = decalage(evenement) < -LARGEUR_SUPPRIMER / 2;
      ligne.classList.remove("glisse");
      devant.style.transform = "";
      fermerLignes();
      if (ouvrir) {
        montrerSupprimer(ligne, true);
        etat.ligneOuverte = ligne.dataset.id;
      }
    }
    depart = null;
  };
  devant.addEventListener("pointerup", finir);
  devant.addEventListener("pointercancel", () => {
    ligne.classList.remove("glisse");
    devant.style.transform = "";
    depart = null;
  });

  // Après un glissement, le doigt levé ne coche ni n'ouvre l'article ; toucher une ligne ouverte la referme.
  devant.addEventListener(
    "click",
    (evenement) => {
      if (!glisse && !ligne.classList.contains("ouverte")) return;
      evenement.stopPropagation();
      evenement.preventDefault();
      if (!glisse) fermerLignes();
      glisse = false;
    },
    true,
  );
}

// Toucher ailleurs referme la ligne ouverte.
document.addEventListener("pointerdown", (evenement) => {
  if (etat.ligneOuverte && !evenement.target.closest(".article.ouverte")) fermerLignes();
});

function supprimerAvecAnnulation(article) {
  fermerLignes();
  supprimerArticle(db, article.id).catch(signalerErreur);
  const { nom, quantite, note, achete } = article;
  proposerAnnulation(`« ${nom} » supprimé.`, () => {
    const remis = { nom, ...(quantite ? { quantite } : {}), ...(note ? { note } : {}) };
    ajouterArticle(db, etat.utilisateur.uid, remis, { achete }).catch(signalerErreur);
  });
}

let attenteAnnulation;
function proposerAnnulation(texte, annuler) {
  clearTimeout(attenteAnnulation);
  $("texte-annulation").textContent = texte;
  $("annulation").hidden = false;
  $("bouton-annuler").onclick = () => {
    $("annulation").hidden = true;
    annuler();
  };
  attenteAnnulation = setTimeout(() => ($("annulation").hidden = true), 6000);
}

// ---------------------------------------------------------------------------------------------
// Modifier ou supprimer un article

function ouvrirArticle(article) {
  etat.articleOuvert = article;
  const auteur = auteurDe(article);
  $("auteur-article").replaceChildren(
    pastilleMembre(auteur.couleur),
    [`Ajouté par ${auteur.nom}`, auteur.quand].filter(Boolean).join(", "),
  );
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

$("bouton-compte").addEventListener("click", () => {
  const moi = etat.utilisateur.uid;
  $("prenom").value = etat.membres[moi]?.prenom ?? "";
  const couleur = couleurDe(moi, etat.membres, uidsConnus());
  for (const choix of document.querySelectorAll('input[name="couleur"]')) choix.checked = choix.value === couleur;
  dessinerLegende();
  afficherMessage($("message-compte"), "");
  $("fenetre-compte").showModal();
});

/** Sous les couleurs, qui a quelle couleur : « ● Camille  ● vous ». */
function dessinerLegende() {
  if (!etat.utilisateur) return;
  const uids = uidsConnus();
  $("legende-membres").replaceChildren(
    ...uids.map((uid) => {
      const membre = document.createElement("span");
      membre.append(pastilleMembre(couleurDe(uid, etat.membres, uids)), nomDe(uid, etat.membres, etat.utilisateur.uid));
      return membre;
    }),
  );
}

$("form-compte").addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const { fiche, erreur } = preparerFiche({
    prenom: $("prenom").value,
    couleur: document.querySelector('input[name="couleur"]:checked')?.value,
  });
  if (erreur) {
    afficherMessage($("message-compte"), erreur, "erreur");
    return;
  }
  // Comme pour les articles, on n'attend pas le serveur : sans réseau, la fiche part plus tard.
  enregistrerMembre(db, etat.utilisateur.uid, fiche).catch((erreurFirebase) => {
    // Refusée : les règles d'accès publiées dans Firebase n'ont pas encore la partie « membres ».
    if (erreurFirebase?.code === "permission-denied") {
      console.error(erreurFirebase);
      afficherMessage($("bandeau"), "Prénom et couleur non enregistrés : règles Firebase à mettre à jour.", "erreur");
    } else {
      signalerErreur(erreurFirebase);
    }
  });
  $("fenetre-compte").close();
});

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
    afficherMessage(bandeau, "Hors connexion : envoi au retour du réseau.", "hors-ligne");
  } else if (depuisLeTelephone && etat.articles.some((a) => a.enAttente)) {
    afficherMessage(bandeau, "Synchronisation en cours…", "info");
  } else {
    afficherMessage(bandeau, "");
  }
}

window.addEventListener("online", () => mettreAJourBandeau());
window.addEventListener("offline", () => mettreAJourBandeau());
