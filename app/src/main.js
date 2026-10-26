// L'appli : connexion, puis liste de courses commune synchronisée entre nos deux iPhones.

import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";

import { messageErreur, pluriel, preparerSaisie, trierArticles, trouverDoublon } from "./articles.js";
import { auth, db } from "./firebase.js";
import { ajouterArticle, cocherArticle, modifierArticle, supprimerArticle, suivreArticles, viderLeCaddie } from "./liste.js";

const $ = (id) => document.getElementById(id);

const etat = {
  utilisateur: null,
  articles: [],
  arreterSuivi: null,
  articleOuvert: null,
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
  remplir($("liste-a-acheter"), aAcheter);
  remplir($("liste-caddie"), dansLeCaddie);
  $("liste-vide").hidden = aAcheter.length > 0;
  $("section-caddie").hidden = dansLeCaddie.length === 0;
  $("titre-caddie").textContent = `Dans le caddie (${dansLeCaddie.length})`;
  $("resume").textContent = aAcheter.length ? `${pluriel(aAcheter.length, "article")} à acheter` : "Rien à acheter";
}

function remplir(liste, articles) {
  liste.replaceChildren(...articles.map(ligneArticle));
}

function ligneArticle(article) {
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
  return ligne;
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
