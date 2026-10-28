// L'appli : connexion, puis liste de courses commune synchronisée entre nos deux iPhones,
// comparée aux promos de notre magasin.

import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { registerSW } from "virtual:pwa-register";

import { messageErreur, pluriel, preparerSaisie, trierArticles, trouverDoublon } from "./articles.js";
import { afficherFichier, nomFichier, partagerFichier, preparerFichier, texteDuTicket } from "./fichiers.js";
import { auth, db } from "./firebase.js";
import { proposerInstallation } from "./installation.js";
import {
  ajouterArticle,
  ajouterTicket,
  cocherArticle,
  corrigerRayon,
  enregistrerMembre,
  lireFichierTicket,
  modifierArticle,
  modifierTicket,
  enregistrerCleRobot,
  lireCleRobot,
  suivreArticles,
  suivreCorrectionsRayons,
  suivreMembres,
  suivreTickets,
  supprimerArticle,
  supprimerTicket,
  viderLeCaddie,
} from "./liste.js";
import { couleurDe, formaterAjout, nomDe, preparerFiche } from "./membres.js";
import {
  URL_PROMOS,
  alerteFraicheur,
  articleDepuisPromo,
  dateDuJour,
  explicationPrix,
  formaterMoment,
  indexerPromos,
  joliNom,
  noteAffichee,
  periode,
  phraseHistorique,
  phraseSource,
  rechercherPromos,
  periodeCourte,
  promoChoisie,
  resumeDescription,
  sourcesEnDifficulte,
  typePromo,
} from "./promos.js";
import {
  CHEZ_LECLERC,
  URL_PRODUITS,
  articleDepuisProduit,
  indexerProduitsPeuAPeu,
  nomDuProduit,
  phrasePrix,
  produitDuCode,
  rechercherProduits,
} from "./produits.js";
import { AUTRES, RAYONS, cleRayon, rangerParRayon, rayonDe } from "./rayons.js";
import {
  ADRESSE_NOUVELLE_CLE,
  ErreurRobot,
  adressePromosFraiches,
  cleValide,
  avanceeDuPassage,
  dernierPassage,
  detailsDuPassage,
  formaterDuree,
  lancerRobot,
} from "./robot.js";
import {
  MAGASINS_TICKET,
  TICKETS_SOUS_LA_LISTE,
  formaterMontant,
  formaterTaille,
  jourEnLettres,
  libelleTicket,
  lireTicket,
  preparerTicket,
  regrouperParMois,
  trierTickets,
} from "./tickets.js";

const $ = (id) => document.getElementById(id);

// Pour les tests, les promos viennent d'un fichier d'exemple au lieu du vrai promos.json.
const ADRESSE_PROMOS = import.meta.env.MODE === "emulateurs" ? "promos-test.json" : URL_PROMOS;
const ADRESSE_PRODUITS = import.meta.env.MODE === "emulateurs" ? "produits-test.json" : URL_PRODUITS;
const RELIRE_LES_PROMOS_APRES = 60 * 60 * 1000; // 1 heure
const RELIRE_LES_PRODUITS_APRES = 24 * 60 * 60 * 1000; // 1 jour : le robot les change chaque semaine
const PROMOS_PAR_PAGE = 30;
/** Entre deux nouvelles du robot lancé depuis l'appli : il met de 2 minutes à une heure (photos). */
const ATTENTE_ROBOT = import.meta.env.MODE === "emulateurs" ? 300 : 10_000;

const etat = {
  utilisateur: null,
  articles: [],
  arreterSuivi: null,
  membres: {}, // { uid: { prenom, couleur } } : qui est qui, pour les pastilles de couleur
  arreterMembres: null,
  places: null, // Map id → « liste » ou « caddie » au dernier dessin : ce qui vient d'arriver s'anime
  correctionsRayons: {}, // { nom réduit : rayon } : les rayons corrigés à la main (voir rayons.js)
  arreterCorrections: null,
  tickets: [], // les tickets de caisse (fiches, sans leur fichier)
  arreterTickets: null,
  ticketOuvert: null, // { ticket, blob, liberer } : le ticket affiché en grand
  ticketEnCours: null, // { ticket, fichier, jeton, touches, arret } : le ticket qu'on ajoute (fichier) ou qu'on corrige (ticket)
  articleOuvert: null,
  ligneOuverte: null, // article dont le bouton « Supprimer » est visible (glissé vers la gauche)
  promos: null, // { donnees, index, luesLe }
  promosIndisponibles: false,
  produits: null, // { index, luesLe } : tous les produits, même sans promo (produits.json)
  produitsEnCours: null, // la lecture de produits.json, pendant qu'elle se fait
  produitsIndisponibles: false,
  // Ce qu'on a trouvé pendant qu'on écrit : combien de promos et de produits sans promo montrer.
  recherche: { texte: "", nombre: PROMOS_PAR_PAGE, nombreProduits: PROMOS_PAR_PAGE },
};

// Le robot lancé depuis l'appli : sa clé GitHub (lue dans Firebase), son suivi, ce qu'il fait.
const robot = { cle: undefined, suivi: null, horloge: null, message: "", genre: "info", passage: null };

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
  etat.arreterTickets?.();
  etat.arreterCorrections?.();
  etat.arreterSuivi = null;
  etat.arreterMembres = null;
  etat.arreterTickets = null;
  etat.arreterCorrections = null;
  etat.correctionsRayons = {};
  etat.places = null;
  etat.articles = [];
  etat.membres = {};
  etat.tickets = [];
  dessinerTickets();
  if (!utilisateur) {
    $("ajout-nom").value = "";
    dessinerSuggestions();
    afficherEcran("connexion");
    return;
  }
  $("email-compte").textContent = utilisateur.email ?? "";
  afficherEcran("appli");
  dessinerListe();
  // Tous les produits, en arrière-plan : prêts quand on cherche un article.
  setTimeout(chargerProduitsSiBesoin, 3000);
  etat.arreterSuivi = suivreArticles(
    db,
    (articles, { depuisLeTelephone }) => {
      etat.articles = articles;
      // Des articles venus d'un produit : sa photo est dans tous les produits.
      if (articles.some((article) => article.produit)) chargerProduitsSiBesoin();
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
  etat.arreterCorrections = suivreCorrectionsRayons(
    db,
    (corrections) => {
      etat.correctionsRayons = corrections;
      dessinerListe();
    },
    (erreur) => console.warn("Rayons corrigés indisponibles :", erreur),
  );
  etat.arreterTickets = suivreTickets(
    db,
    (tickets) => {
      etat.tickets = tickets;
      dessinerTickets();
    },
    (erreur) => console.warn("Tickets de caisse indisponibles :", erreur),
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
  const rayons = rangerParRayon(aAcheter, etat.correctionsRayons);
  const aujourdhui = dateDuJour();
  // Rangés par rayon, dans l'ordre du magasin. À droite d'un article ajouté depuis une promo
  // (« + Ajouter ») : cette promo, toujours à jour.
  $("liste-a-acheter").replaceChildren(
    ...rayons.map(({ rayon, articles }) => {
      const section = element("section", "rayon");
      section.setAttribute("aria-label", rayon.nom);
      const titre = element("h3", "titre-rayon", rayon.nom);
      const liste = element("ul", "liste");
      liste.append(...articles.map((a) => ligneArticle(a, promoChoisie(a, etat.promos?.index, aujourdhui))));
      section.append(titre, liste);
      return section;
    }),
  );
  $("liste-caddie").replaceChildren(...dansLeCaddie.map((a) => ligneArticle(a)));
  $("liste-vide").hidden = aAcheter.length > 0;
  $("section-caddie").hidden = dansLeCaddie.length === 0;
  $("titre-caddie").textContent = `Dans le caddie (${dansLeCaddie.length})`;
  // Un article qui vient d'arriver dans la liste ou dans le caddie (ajouté, coché, ou venu de l'autre
  // téléphone) apparaît en douceur ; pas au premier affichage.
  const places = new Map([...aAcheter.map((a) => [a.id, "liste"]), ...dansLeCaddie.map((a) => [a.id, "caddie"])]);
  if (etat.places) {
    for (const ligne of document.querySelectorAll(".article")) {
      if (etat.places.get(ligne.dataset.id) !== places.get(ligne.dataset.id)) ligne.classList.add("arrive");
    }
  }
  etat.places = places;
  dessinerEtatPromos();
}

/** Fait partir des lignes en douceur (elles glissent et s'effacent), puis lance `action`. */
function fairePartir(lignes, action) {
  const animees = [...lignes].filter((ligne) => !ligne.classList.contains("part"));
  if (!animees.length) return;
  for (const ligne of animees) ligne.classList.add("part");
  setTimeout(action, mouvementReduit.matches ? 0 : DUREE_DEPART);
}

/** Durée du départ d'une ligne, comme dans style.css (« .article.part »). */
const DUREE_DEPART = 180;

/** Préférence de l'iPhone « Réduire les animations » : alors, aucune. */
const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)");

function ligneArticle(article, promo = null) {
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
    fairePartir([ligne], () => cocherArticle(db, article).catch(signalerErreur));
  });
  // Sous le rond : la pastille de celui qui a ajouté l'article.
  const auteur = auteurDe(article);
  caseACocher.append(pastilleMembre(auteur.couleur));

  // Le nom, puis quand il a été ajouté, la quantité et la note.
  const contenu = document.createElement("button");
  contenu.type = "button";
  contenu.className = "texte";
  // Lu par VoiceOver : « Modifier Pain, 18:02 · 2 L, ajouté par Camille ».
  const nom = document.createElement("span");
  nom.className = "nom";
  nom.textContent = article.nom;
  contenu.append(element("span", "cache", "Modifier "), nom);
  const details = [auteur.quand, article.quantite, noteAffichee(article.note)].filter(Boolean).join(" · ");
  if (details) {
    const sousTitre = document.createElement("span");
    sousTitre.className = "details";
    sousTitre.textContent = details;
    contenu.append(sousTitre);
  }
  contenu.append(element("span", "cache", `, ajouté par ${auteur.nom}`));
  contenu.addEventListener("click", () => ouvrirArticle(article));

  // Devant : la ligne elle-même ; derrière : le bouton « Supprimer », qu'on découvre en glissant.
  const devant = document.createElement("div");
  devant.className = "article-devant";
  devant.append(caseACocher);
  // La photo du produit, en petit (rien sans photo sûre) : celle de sa promo (la toucher montre la
  // promo), sinon celle du produit d'où vient l'article.
  if (adresseSure(promo?.offre?.photo)) {
    const photo = imageDuRobot(promo.offre.photo, "photo-article", "", (image) => image.remove());
    photo.addEventListener("click", () => ouvrirPromo(article, promo));
    devant.append(photo);
  } else if (adresseSure(produitDuCode(etat.produits?.index, article.produit)?.photo)) {
    const photo = produitDuCode(etat.produits.index, article.produit).photo;
    devant.append(imageDuRobot(photo, "photo-article", "", (image) => image.remove()));
  }
  devant.append(contenu);
  if (promo?.terminee) devant.append(element("span", "promo-terminee", "Promo terminée"));
  else if (promo) devant.append(boutonPromo(article, promo));

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

function boutonPromo(article, promo) {
  // Sous l'étiquette, le type de la promo : « -60 % sur le 2e », « -20 % en caisse »…
  const { offre, aVenir } = promo;
  const type = [typePromo(offre), aVenir ? periodeCourte(offre, dateDuJour()) : null].filter(Boolean).join(" · ");
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "bouton-promos";
  const pastille = document.createElement("span");
  pastille.className = "pastille";
  pastille.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />' +
    '<circle cx="7.5" cy="7.5" r="1.2" /></svg>';
  pastille.append("Promo");
  const legende = document.createElement("span");
  legende.className = "type-promo";
  legende.textContent = type;
  // Lu par VoiceOver : « Voir la promo de Lait : -15 % en caisse ».
  bouton.append(
    element("span", "cache", "Voir la "),
    pastille,
    element("span", "cache", ` de ${article.nom} : `),
    legende,
  );
  bouton.addEventListener("click", () => ouvrirPromo(article, promo));
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
    fairePartir(document.querySelectorAll("#liste-caddie .article"), () =>
      viderLeCaddie(db, dansLeCaddie).catch(signalerErreur),
    );
    // Les courses sont finies : c'est le moment de garder le ticket.
    proposerAction("Courses finies : garder le ticket ?", "Ajouter", choisirFichierTicket, 12_000);
  }
});

// ---------------------------------------------------------------------------------------------
// Les promos

/** Lit promos.json ; `adresse` : une autre copie (celle que le robot vient d'écrire, voir robot.js). */
async function chargerPromos(adresse = ADRESSE_PROMOS) {
  try {
    const reponse = await fetch(adresse, { cache: "no-cache", signal: AbortSignal.timeout(20_000) });
    if (!reponse.ok) throw new Error(`promos.json : erreur ${reponse.status}`);
    const donnees = await reponse.json();
    // GitHub sert parfois une copie de quelques minutes : jamais de promos plus anciennes que celles qu'on a.
    if (etat.promos && donnees.mise_a_jour < etat.promos.donnees.mise_a_jour) {
      etat.promos.luesLe = Date.now();
      return;
    }
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

/**
 * Lit produits.json (tous les produits, même sans promo : quelques Mo, gardés sur le téléphone par le
 * service de l'appli, voir vite.config.js) la première fois qu'on en a besoin, puis une fois par jour.
 */
function chargerProduitsSiBesoin() {
  const recents = etat.produits && Date.now() - etat.produits.luesLe < RELIRE_LES_PRODUITS_APRES;
  if (recents || etat.produitsEnCours) return;
  etat.produitsEnCours = (async () => {
    try {
      const reponse = await fetch(ADRESSE_PRODUITS, { signal: AbortSignal.timeout(60_000) });
      if (!reponse.ok) throw new Error(`produits.json : erreur ${reponse.status}`);
      etat.produits = { index: await indexerProduitsPeuAPeu(await reponse.json()), luesLe: Date.now() };
      etat.produitsIndisponibles = false;
    } catch (erreur) {
      console.warn("Produits indisponibles :", erreur);
      etat.produitsIndisponibles = !etat.produits; // si on en avait déjà, on les garde
    } finally {
      etat.produitsEnCours = null;
    }
    dessinerListe();
    dessinerSuggestions();
  })();
}

/** Prévient si les promos manquent, sont anciennes ou incomplètes ; rappelle leur date en bas. */
function dessinerEtatPromos() {
  // Pendant que le robot travaille (« Mettre à jour les promos »), on suit son avancée ici.
  if (robot.message) {
    afficherMessage($("etat-promos"), robot.message, robot.genre);
    const voir = element("button", "lien lien-avancee", "Voir l'avancée");
    voir.type = "button";
    voir.addEventListener("click", ouvrirAvancee);
    $("etat-promos").append(" ", voir);
    return;
  }
  const alertes = [];
  if (etat.promosIndisponibles) {
    alertes.push("Promos indisponibles (pas de réseau ?).");
  } else if (etat.promos) {
    alertes.push(alerteFraicheur(etat.promos.donnees.mise_a_jour));
    alertes.push(...sourcesEnDifficulte(etat.promos.donnees).map(phraseSource));
  }
  afficherMessage($("etat-promos"), alertes.filter(Boolean).join(" "), "attention");
}

function ouvrirPromo(article, { offre, aVenir }) {
  $("titre-fenetre-promos").textContent = `Promo pour « ${article.nom} »`;
  $("liste-promos").replaceChildren(cartePromo(offre, aVenir, dateDuJour()));
  $("fenetre-promos").showModal();
  $("liste-promos").scrollTop = 0;
}

function element(balise, classe, texte) {
  const el = document.createElement(balise);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

/**
 * Une promo, rangée pour se lire d'un coup d'œil : la photo du produit et, à côté, jusqu'à quand, le
 * produit et sa taille ; dessous, le prix, le type de promo (couleur selon l'endroit où va la
 * réduction), le détail utile et ce qu'en dit l'historique des prix.
 */
function cartePromo(offre, aVenir, aujourdhui, { avecAjout = false } = {}) {
  const carte = element("li", "promo");
  carte.toggleAttribute("data-a-venir", aVenir);

  // En haut : jusqu'à quand et, dans le coin, la marque ; puis le nom du produit.
  const haut = element("div", "promo-haut");
  haut.append(element("p", "periode", periode(offre, aujourdhui)));
  const marque = marquePromo(offre);
  if (marque) haut.append(marque);
  const textes = element("div", "promo-textes");
  textes.append(haut, element("p", "promo-nom", joliNom(offre.produit)));
  const description = resumeDescription(offre.description);
  if (description) textes.append(element("p", "promo-description", description));
  const tete = element("div", "promo-tete");
  tete.append(photoPromo(offre), textes);
  carte.append(tete);

  // Le prix payé en caisse, l'ancien prix, le prix au kilo ; à droite, le bouton pour l'ajouter.
  const explication = explicationPrix(offre);
  const lignePrix = element("div", "promo-ligne-prix");
  const prix = element("p", "promo-prix");
  if (explication.prix) prix.append(element("strong", "prix", explication.prix));
  if (explication.barre) {
    prix.append(element("span", "cache", " au lieu de "), element("s", "ancien-prix", explication.barre));
  }
  if (explication.unitaire) prix.append(element("span", "prix-unitaire", explication.unitaire));
  lignePrix.append(prix);
  // À droite : « + Ajouter » pendant qu'on écrit un article ; sinon, le lien vers le catalogue.
  if (avecAjout) {
    lignePrix.append(boutonAjouter(offre));
  } else if (/^https:\/\//.test(offre.lien ?? "")) {
    const lien = element("a", "lien-catalogue", "Catalogue");
    lien.href = offre.lien;
    lien.target = "_blank";
    lien.rel = "noopener noreferrer";
    lien.setAttribute("aria-label", `Voir ${joliNom(offre.produit)} dans le catalogue`);
    lignePrix.append(lien);
  }
  carte.append(lignePrix);

  // Le type de promo (« -60 % sur le 2e », « 30 % sur la carte »…) et le détail utile.
  if (explication.genre !== "aucun") {
    const bas = element("div", "promo-bas");
    const type = element("span", "type", typePromo(offre));
    type.dataset.genre = explication.genre;
    bas.append(type);
    if (explication.detail) bas.append(element("span", "detail", explication.detail));
    carte.append(bas);
  }

  // L'historique des prix : le prix le plus bas vu, aussi bas que le meilleur, ou déjà vu moins cher.
  const historique = phraseHistorique(offre);
  if (historique) {
    const ligne = element("p", "historique-prix", historique.texte);
    ligne.dataset.genre = historique.genre;
    carte.append(ligne);
  }
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
  const actives = texte.length >= LETTRES_MINIMUM && Boolean(index || etat.produits || etat.produitsEnCours);
  $("suggestions").hidden = !actives;
  $("contenu").hidden = actives; // la liste revient dès que le champ est vide
  if (!actives) return;

  if (texte !== etat.recherche.texte) {
    etat.recherche = { texte, nombre: PROMOS_PAR_PAGE, nombreProduits: PROMOS_PAR_PAGE };
  }
  const aujourdhui = dateDuJour();
  const resultats = index ? rechercherPromos(index, texte, aujourdhui) : [];
  const n = resultats.length;
  $("groupe-promos").hidden = n === 0;
  $("resultats").replaceChildren(
    ...resultats
      .slice(0, etat.recherche.nombre)
      .map(({ offre, aVenir }) => cartePromo(offre, aVenir, aujourdhui, { avecAjout: true })),
  );
  $("plus-de-resultats").hidden = n <= etat.recherche.nombre;

  // Puis tous les autres produits, sans promo (un produit en promo n'est montré qu'en promo).
  const sansPromo = etat.produits ? produitsSansPromo(texte, aujourdhui) : [];
  const m = sansPromo.length;
  $("groupe-produits").hidden = !etat.produits && !etat.produitsEnCours;
  afficherMessage($("etat-produits"), etat.produits ? (m ? "" : "Aucun autre produit") : "Chargement des produits…");
  $("resultats-produits").replaceChildren(
    ...sansPromo.slice(0, etat.recherche.nombreProduits).map((produit) => carteProduit(produit)),
  );
  $("plus-de-produits").hidden = m <= etat.recherche.nombreProduits;

  const promos = n === 0 ? "Aucune promo" : pluriel(n, "promo");
  const produits = etat.produits ? ` · ${m === 0 ? "aucun" : m} sans promo` : "";
  const ajout = n === 0 && m === 0 ? " · + pour l'ajouter" : "";
  $("etat-recherche").textContent = `${promos}${produits}${ajout}`;
}

/** Les produits qui correspondent à ce qu'on écrit, sauf ceux en promo en ce moment. */
function produitsSansPromo(texte, aujourdhui) {
  const enPromo = new Set(
    (etat.promos?.index ?? [])
      .filter(({ offre }) => offre.ean && (!offre.date_fin || offre.date_fin >= aujourdhui))
      .map(({ offre }) => offre.ean),
  );
  return rechercherProduits(etat.produits.index, texte, { exclure: enPromo });
}

let attenteRecherche;
$("ajout-nom").addEventListener("input", () => {
  chargerProduitsSiBesoin(); // la première fois qu'on écrit : tous les produits, même sans promo
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

$("plus-de-produits").addEventListener("click", () => {
  etat.recherche.nombreProduits += PROMOS_PAR_PAGE;
  dessinerSuggestions();
});

/**
 * La marque, en haut à droite : son logo (une vignette faite par le robot, d'après le catalogue ou
 * Wikipédia ; le logo Marque Repère pour tous ses produits), sinon son nom en petit. Rien pour un
 * produit sans marque.
 */
function marquePromo(offre) {
  if (!offre.marque) return null;
  const nom = () => element("span", "marque-promo", offre.marque);
  if (!adresseSure(offre.logo)) return nom();
  // Le texte de remplacement est lu par VoiceOver : le nom de la marque n'est écrit nulle part ailleurs.
  const texte = offre.logo_marque ? `${offre.logo_marque} (${offre.marque})` : offre.marque;
  return imageDuRobot(offre.logo, "logo-marque", texte, (logo) => logo.replaceWith(nom()));
}

const adresseSure = (adresse) => /^https:\/\//.test(adresse ?? "");

/**
 * Une image faite par le robot (photo d'un produit, logo d'une marque) : chargée quand elle devient
 * visible et gardée sur le téléphone pour le mode hors ligne. `siIntrouvable(image)` la remplace si
 * elle ne se charge pas : jamais d'image cassée.
 */
function imageDuRobot(adresse, classe, texte, siIntrouvable) {
  const image = document.createElement("img");
  image.className = classe;
  image.alt = texte;
  image.loading = "lazy";
  image.decoding = "async";
  image.crossOrigin = "anonymous"; // une réponse lisible, que le téléphone peut garder
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => siIntrouvable(image), { once: true });
  image.src = adresse;
  return image;
}

/**
 * La photo du produit (une vignette faite par le robot, seulement quand elle est sûre), ou un
 * emplacement neutre : jamais une photo qui pourrait tromper. Décorative : le nom est juste à côté.
 */
function photoPromo(offre) {
  if (!adresseSure(offre.photo)) return sansPhoto("photo-promo");
  return imageDuRobot(offre.photo, "photo-promo", "", (image) => image.replaceWith(sansPhoto("photo-promo")));
}

/** L'emplacement neutre (un sac), quand il n'y a pas de photo sûre. */
function sansPhoto(classe) {
  const cadre = element("span", `${classe} sans-photo`);
  cadre.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>';
  return cadre;
}

/** « Ajouter à la liste », ou « Dans la liste » si l'article y est déjà. */
/**
 * Ajoute un article venu d'une promo ou d'un produit. Comme pour l'ajout dans la liste : sans réseau,
 * il part plus tard. Si les règles d'accès publiées dans Firebase ne connaissent pas encore le champ
 * « produit » (ou « promo »), l'article est ajouté sans : sa promo est alors retrouvée d'après sa
 * note (« Leclerc · 2,25 € »).
 */
function ajouterAvecRepli(article) {
  const { produit, ...sansProduit } = article;
  const { promo, ...sansRien } = sansProduit;
  const essais = [article, ...(produit ? [sansProduit] : []), ...(promo ? [sansRien] : [])];
  const essayer = ([premier, ...suivants]) =>
    ajouterArticle(db, etat.utilisateur.uid, premier).catch((refus) => {
      if (refus?.code !== "permission-denied" || !suivants.length) throw refus;
      return essayer(suivants);
    });
  essayer(essais).catch(signalerErreur);
}

function boutonAjouter(offre) {
  const bouton = element("button", "bouton-ajouter");
  bouton.type = "button";
  bouton.dataset.nom = articleDepuisPromo(offre).nom;
  mettreAJourBoutonAjout(bouton);
  bouton.addEventListener("click", () => {
    const { article, erreur } = preparerSaisie(articleDepuisPromo(offre));
    if (erreur) return;
    ajouterAvecRepli(article);
    bouton.disabled = true;
    bouton.textContent = "✓ Ajouté";
  });
  return bouton;
}

/**
 * Un produit sans promo, trouvé dans tous les produits : sa photo, son nom, sa marque (son logo
 * quand on le connaît) et sa contenance, son prix habituel quand un catalogue Leclerc l'a donné, et
 * de quoi l'ajouter à la liste. Plus sobre qu'une promo : pas de pastille de couleur.
 */
function carteProduit(produit) {
  const carte = element("li", "produit");
  const photo = adresseSure(produit.photo)
    ? imageDuRobot(produit.photo, "photo-produit", "", (image) => image.replaceWith(sansPhoto("photo-produit")))
    : sansPhoto("photo-produit");
  const textes = element("div", "produit-textes");
  textes.append(element("p", "produit-nom", nomDuProduit(produit)));
  // La marque (son logo quand on le connaît, sinon son nom) et la contenance.
  const precisions = element("p", "produit-precisions");
  const logo = logoDuProduit(produit);
  if (logo) precisions.append(logo);
  else if (produit.marque) precisions.append(element("span", "produit-marque", produit.marque));
  if (produit.quantite) precisions.append(element("span", "produit-quantite", produit.quantite));
  if (precisions.childElementCount) textes.append(precisions);
  textes.append(element("p", "produit-prix", phrasePrix(produit) ?? "Prix en magasin"));
  carte.append(photo, textes, boutonAjouterProduit(produit));
  return carte;
}

/** Le logo de la marque d'un produit sans promo, quand une promo en cours de cette marque en a un. */
function logoDuProduit(produit) {
  const logos = logosDesMarques();
  const logo =
    produit.leclerc === CHEZ_LECLERC.marqueRepere ? logos.marqueRepere : logos.parMarque.get(cleMarque(produit.marque));
  if (!logo) return null;
  const texte = produit.leclerc === CHEZ_LECLERC.marqueRepere ? `Marque Repère (${produit.marque})` : produit.marque;
  return imageDuRobot(logo, "logo-marque logo-produit", texte, (image) =>
    image.replaceWith(element("span", "produit-marque", produit.marque ?? "")),
  );
}

const cleMarque = (marque) =>
  String(marque ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toUpperCase();

/** Les logos connus, d'après les promos en cours : par marque, et celui de Marque Repère. */
function logosDesMarques() {
  const index = etat.promos?.index;
  if (logosDesMarques.index === index) return logosDesMarques.connus;
  const connus = { parMarque: new Map(), marqueRepere: null };
  for (const { offre } of index ?? []) {
    if (!adresseSure(offre.logo)) continue;
    if (offre.logo_marque === "Marque Repère") connus.marqueRepere ??= offre.logo;
    else if (!offre.logo_marque && offre.marque) connus.parMarque.set(cleMarque(offre.marque), offre.logo);
  }
  logosDesMarques.index = index;
  logosDesMarques.connus = connus;
  return connus;
}

function boutonAjouterProduit(produit) {
  const bouton = element("button", "bouton-ajouter");
  bouton.type = "button";
  bouton.dataset.nom = nomDuProduit(produit);
  mettreAJourBoutonAjout(bouton);
  bouton.addEventListener("click", () => {
    const { article, erreur } = preparerSaisie(articleDepuisProduit(produit));
    if (erreur) return;
    ajouterAvecRepli(article);
    bouton.disabled = true;
    bouton.textContent = "✓ Ajouté";
  });
  return bouton;
}

function mettreAJourBoutonAjout(bouton) {
  const nom = bouton.dataset.nom;
  const dejaDansLaListe = Boolean(trouverDoublon(etat.articles, nom));
  bouton.disabled = dejaDansLaListe;
  bouton.textContent = dejaDansLaListe ? "✓ Dans la liste" : "+ Ajouter";
  bouton.setAttribute("aria-label", dejaDansLaListe ? `${nom} : déjà dans la liste` : `Ajouter ${nom} à la liste`);
}

function mettreAJourBoutonsAjout() {
  for (const bouton of document.querySelectorAll("#suggestions .bouton-ajouter")) mettreAJourBoutonAjout(bouton);
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
  const quand = formaterAjout(article.cree_le?.toDate?.());
  return {
    nom: nomDe(uid, etat.membres, etat.utilisateur?.uid),
    couleur: couleurDe(uid, etat.membres, uidsConnus()),
    quand,
    // Pour la fenêtre de l'article et VoiceOver : « aujourd'hui à 13:38 » plutôt que « 13:38 ».
    quandEnClair: /^\d\d:\d\d$/.test(quand) ? `aujourd'hui à ${quand}` : quand,
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
  fairePartir(document.querySelectorAll(`.article[data-id="${article.id}"]`), () =>
    supprimerArticle(db, article.id).catch(signalerErreur),
  );
  const { nom, quantite, note, promo, achete } = article;
  proposerAnnulation(`« ${nom} » supprimé.`, () => {
    const remis = { nom, ...(quantite ? { quantite } : {}), ...(note ? { note } : {}), ...(promo ? { promo } : {}) };
    ajouterArticle(db, etat.utilisateur.uid, remis, { achete }).catch(signalerErreur);
  });
}

let attenteAnnulation;
function proposerAnnulation(texte, annuler) {
  proposerAction(texte, "Annuler", annuler, 6000);
}

/** Un message en bas de l'écran avec un bouton (« Annuler », « Ajouter »…), qui disparaît tout seul. */
function proposerAction(texte, libelle, action, duree) {
  clearTimeout(attenteAnnulation);
  $("texte-annulation").textContent = texte;
  $("bouton-annuler").textContent = libelle;
  $("fermer-annulation").hidden = libelle === "Annuler";
  $("annulation").hidden = false;
  $("bouton-annuler").onclick = () => {
    $("annulation").hidden = true;
    action();
  };
  attenteAnnulation = setTimeout(() => ($("annulation").hidden = true), duree);
}

$("fermer-annulation").addEventListener("click", () => ($("annulation").hidden = true));

// ---------------------------------------------------------------------------------------------
// Modifier ou supprimer un article

function ouvrirArticle(article) {
  etat.articleOuvert = article;
  const auteur = auteurDe(article);
  $("auteur-article").replaceChildren(
    pastilleMembre(auteur.couleur),
    [`Ajouté par ${auteur.nom}`, auteur.quandEnClair].filter(Boolean).join(" "),
  );
  $("modif-nom").value = article.nom;
  $("modif-quantite").value = article.quantite ?? "";
  $("modif-note").value = article.note ?? "";
  $("modif-rayon").value = rayonDe(article.nom, etat.correctionsRayons).id;
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
  // Un rayon changé à la main est retenu pour ce nom d'article, sur les deux téléphones.
  const rayon = $("modif-rayon").value;
  if (rayon !== rayonDe(article.nom, etat.correctionsRayons).id) {
    corrigerRayon(db, cleRayon(article.nom), rayon).catch(signalerErreur);
  }
  $("fenetre-article").close();
});

// Les rayons proposés dans la fenêtre d'un article.
$("modif-rayon").replaceChildren(
  ...[...RAYONS, AUTRES].map(({ id, nom }) => {
    const choix = element("option", null, nom);
    choix.value = id;
    return choix;
  }),
);

$("supprimer-article").addEventListener("click", async () => {
  const article = etat.articleOuvert;
  $("fenetre-article").close();
  if (await confirmer(`Supprimer « ${article.nom} » de la liste ?`)) {
    supprimerArticle(db, article.id).catch(signalerErreur);
  }
});

// ---------------------------------------------------------------------------------------------
// Les tickets de caisse : les derniers sous la liste, tous dans « Voir les tickets »

function dessinerTickets() {
  const tickets = trierTickets(etat.tickets);
  $("liste-tickets").replaceChildren(...tickets.slice(0, TICKETS_SOUS_LA_LISTE).map(ligneTicket));
  $("voir-tickets").hidden = tickets.length <= TICKETS_SOUS_LA_LISTE;
  $("voir-tickets").textContent = `Voir les ${tickets.length} tickets`;
  if ($("fenetre-tickets").open) dessinerTousLesTickets();
  // Le ticket affiché a été corrigé ou supprimé sur l'autre téléphone.
  if (etat.ticketOuvert) {
    const aJour = etat.tickets.find((t) => t.id === etat.ticketOuvert.ticket.id);
    if (aJour) dessinerEnteteTicket((etat.ticketOuvert.ticket = aJour));
    else $("fenetre-ticket").close();
  }
}

function ligneTicket(ticket) {
  const ligne = document.createElement("li");
  ligne.className = "ticket";
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "ligne-ticket";
  const icone = document.createElement("span");
  icone.className = "icone-ticket";
  icone.dataset.magasin = ticket.magasin;
  icone.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>';
  const texte = document.createElement("span");
  texte.className = "texte-ticket";
  const titre = document.createElement("span");
  titre.className = "nom";
  titre.textContent = libelleTicket(ticket);
  // Lu par VoiceOver : « Ouvrir le ticket Leclerc · mar. 27/10 · 54,30 € ».
  texte.append(element("span", "cache", "Ouvrir le ticket "), titre);
  const details = [ticket.note, ticket.enAttente ? "envoi en cours…" : null].filter(Boolean).join(" · ");
  if (details) {
    const sousTitre = document.createElement("span");
    sousTitre.className = "details";
    sousTitre.textContent = details;
    texte.append(sousTitre);
  }
  const fleche = document.createElement("span");
  fleche.className = "fleche";
  fleche.setAttribute("aria-hidden", "true");
  fleche.textContent = "›";
  bouton.append(icone, texte, fleche);
  bouton.addEventListener("click", () => ouvrirTicket(ticket));
  ligne.append(bouton);
  return ligne;
}

function dessinerTousLesTickets() {
  $("tous-les-tickets").replaceChildren(
    ...regrouperParMois(etat.tickets).map(({ mois, tickets }) => {
      const groupe = document.createElement("section");
      const titre = document.createElement("h3");
      titre.className = "mois";
      titre.textContent = mois;
      const liste = document.createElement("ul");
      liste.className = "liste";
      liste.append(...tickets.map(ligneTicket));
      groupe.append(titre, liste);
      return groupe;
    }),
  );
}

$("voir-tickets").addEventListener("click", () => {
  dessinerTousLesTickets();
  $("fenetre-tickets").showModal();
});

// Ajouter un ticket : l'iPhone propose de prendre une photo, la photothèque (captures d'écran) ou
// Fichiers (le PDF de l'appli E.Leclerc).
function choisirFichierTicket() {
  $("fichier-ticket").click();
}

$("ajouter-ticket").addEventListener("click", choisirFichierTicket);

$("fichier-ticket").addEventListener("change", () => {
  const fichier = $("fichier-ticket").files[0];
  $("fichier-ticket").value = ""; // pour pouvoir choisir le même fichier une autre fois
  if (fichier) ouvrirFormulaireTicket({ fichier });
});

let jetonsTicket = 0;

/** La fenêtre du ticket : nouveau (avec son fichier) ou à corriger (sans toucher au fichier). */
async function ouvrirFormulaireTicket({ fichier = null, ticket = null }) {
  etat.ticketEnCours?.arret.abort();
  const enCours = {
    ticket,
    fichier: null,
    jeton: (jetonsTicket += 1),
    touches: new Set(),
    arret: new AbortController(),
  };
  etat.ticketEnCours = enCours;
  $("titre-ajout-ticket").textContent = ticket ? "Modifier le ticket" : "Nouveau ticket";
  const magasin = ticket?.magasin ?? "leclerc";
  for (const choix of document.querySelectorAll('input[name="magasin"]')) choix.checked = choix.value === magasin;
  $("date-ticket").value = ticket?.date_achat ?? dateDuJour();
  $("date-ticket").max = dateDuJour();
  $("montant-ticket").value = ticket?.montant != null ? ticket.montant.toFixed(2).replace(".", ",") : "";
  $("note-ticket").value = ticket?.note ?? "";
  afficherMessage($("message-ticket"), "");
  afficherMessage($("lecture-ticket"), "");
  $("apercu-ticket").hidden = !fichier;
  $("apercu-ticket").replaceChildren(texteDiscret("Préparation du ticket…"));
  $("enregistrer-ticket").disabled = Boolean(fichier);
  if (!$("fenetre-ajout-ticket").open) $("fenetre-ajout-ticket").showModal();
  if (!fichier) return;
  try {
    const prepare = await preparerFichier(fichier);
    if (etat.ticketEnCours?.jeton !== enCours.jeton) {
      if (prepare.apercu) URL.revokeObjectURL(prepare.apercu);
      return;
    }
    enCours.fichier = prepare;
    $("apercu-ticket").replaceChildren(apercuTicket(prepare));
    $("enregistrer-ticket").disabled = false;
    lireLeTicket(enCours);
  } catch (erreur) {
    console.error(erreur);
    if (etat.ticketEnCours?.jeton !== enCours.jeton) return;
    $("apercu-ticket").replaceChildren();
    afficherMessage($("message-ticket"), erreur.message, "erreur");
  }
}

/**
 * Lit le ticket (sur le téléphone) et remplit le magasin, la date et le total trouvés, sans toucher
 * à ce qu'on a déjà changé à la main. On peut enregistrer sans attendre la fin de la lecture.
 */
async function lireLeTicket(enCours) {
  const encoreOuvert = () => etat.ticketEnCours?.jeton === enCours.jeton;
  afficherMessage($("lecture-ticket"), "Lecture du ticket…", "info");
  try {
    const lu = lireTicket(await texteDuTicket(enCours.fichier, enCours.arret.signal), dateDuJour());
    if (!encoreOuvert()) return;
    const remplis = [];
    if (lu.magasin && !enCours.touches.has("magasin")) {
      for (const choix of document.querySelectorAll('input[name="magasin"]'))
        choix.checked = choix.value === lu.magasin;
      remplis.push("magasin");
    }
    if (lu.date && !enCours.touches.has("date")) {
      $("date-ticket").value = lu.date;
      remplis.push("date");
    }
    if (lu.montant != null && !enCours.touches.has("montant")) {
      $("montant-ticket").value = lu.montant.toFixed(2).replace(".", ",");
      remplis.push("total");
    }
    afficherMessage(
      $("lecture-ticket"),
      remplis.length
        ? `${enPhrase(remplis)} ${remplis.length > 1 ? "lus" : "lu"} sur le ticket : vérifiez.`
        : "Rien de lisible sur le ticket : complétez à la main.",
      remplis.length ? "succes" : "info",
    );
  } catch (erreur) {
    console.warn("Lecture du ticket impossible :", erreur);
    if (encoreOuvert()) afficherMessage($("lecture-ticket"), "Lecture impossible : complétez à la main.", "info");
  }
}

/** ["total", "date"] → « Total et date ». */
function enPhrase(mots) {
  const texte = mots.length > 1 ? `${mots.slice(0, -1).join(", ")} et ${mots.at(-1)}` : mots[0];
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// Ce qu'on change à la main n'est jamais remplacé par la lecture du ticket.
function noterChampTouche({ target }) {
  const champ =
    target.name === "magasin" ? "magasin" : { "date-ticket": "date", "montant-ticket": "montant" }[target.id];
  if (champ) etat.ticketEnCours?.touches.add(champ);
}
$("form-ticket").addEventListener("input", noterChampTouche);
$("form-ticket").addEventListener("change", noterChampTouche);

function apercuTicket({ octets, apercu }) {
  if (apercu) {
    const image = document.createElement("img");
    image.src = apercu;
    image.alt = "Aperçu du ticket";
    return image;
  }
  const carte = document.createElement("p");
  carte.className = "apercu-pdf";
  carte.textContent = `PDF · ${formaterTaille(octets.length)}`;
  return carte;
}

function texteDiscret(texte) {
  const paragraphe = document.createElement("p");
  paragraphe.className = "discret";
  paragraphe.textContent = texte;
  return paragraphe;
}

$("form-ticket").addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const enCours = etat.ticketEnCours;
  if (!enCours || (!enCours.ticket && !enCours.fichier)) return;
  const { fiche, erreur } = preparerTicket(
    {
      magasin: document.querySelector('input[name="magasin"]:checked')?.value,
      date: $("date-ticket").value,
      montant: $("montant-ticket").value,
      note: $("note-ticket").value,
    },
    dateDuJour(),
  );
  if (erreur) {
    afficherMessage($("message-ticket"), erreur, "erreur");
    return;
  }
  // Comme pour les articles, on n'attend pas le serveur : sans réseau, le ticket part plus tard.
  if (enCours.ticket) modifierTicket(db, enCours.ticket.id, fiche).catch(signalerErreur);
  else ajouterTicket(db, etat.utilisateur.uid, fiche, enCours.fichier).envoi.catch(signalerErreur);
  $("fenetre-ajout-ticket").close();
});

$("fenetre-ajout-ticket").addEventListener("close", () => {
  etat.ticketEnCours?.arret.abort(); // la lecture du ticket ne sert plus : on l'arrête
  if (etat.ticketEnCours?.fichier?.apercu) URL.revokeObjectURL(etat.ticketEnCours.fichier.apercu);
  etat.ticketEnCours = null;
  $("apercu-ticket").replaceChildren();
});

// Un ticket en grand : la photo, ou chaque page du PDF.
async function ouvrirTicket(ticket) {
  const ouverture = { ticket, blob: null, liberer: null };
  etat.ticketOuvert = ouverture;
  dessinerEnteteTicket(ticket);
  $("fichier-affiche").replaceChildren(texteDiscret("Ouverture du ticket…"));
  $("partager-ticket").disabled = true;
  $("fenetre-ticket").showModal();
  try {
    const blob = await lireFichierTicket(db, ticket);
    if (etat.ticketOuvert !== ouverture) return;
    ouverture.blob = blob;
    ouverture.liberer = await afficherFichier(blob, $("fichier-affiche"));
    if (etat.ticketOuvert !== ouverture) {
      ouverture.liberer?.();
      return;
    }
    $("partager-ticket").disabled = false;
  } catch (erreur) {
    console.error(erreur);
    if (etat.ticketOuvert !== ouverture) return;
    $("fichier-affiche").replaceChildren(texteDiscret(erreur.code ? messageErreur(erreur) : erreur.message));
  }
}

function dessinerEnteteTicket(ticket) {
  $("titre-ticket").textContent = `${MAGASINS_TICKET[ticket.magasin] ?? "Ticket"}, ${jourEnLettres(ticket.date_achat)}`;
  $("infos-ticket").textContent = [
    ticket.montant != null ? formaterMontant(ticket.montant) : null,
    ticket.note,
    `ajouté par ${nomDe(ticket.ajoute_par, etat.membres, etat.utilisateur?.uid)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

$("fenetre-ticket").addEventListener("close", () => {
  etat.ticketOuvert?.liberer?.();
  etat.ticketOuvert = null;
  $("fichier-affiche").replaceChildren();
});

$("partager-ticket").addEventListener("click", () => {
  const { ticket, blob } = etat.ticketOuvert ?? {};
  if (blob) partagerFichier(blob, nomFichier(ticket)).catch(signalerErreur);
});

$("modifier-ticket").addEventListener("click", () => {
  if (etat.ticketOuvert) ouvrirFormulaireTicket({ ticket: etat.ticketOuvert.ticket });
});

$("supprimer-ticket").addEventListener("click", async () => {
  const ticket = etat.ticketOuvert?.ticket;
  if (!ticket) return;
  if (await confirmer("Supprimer ce ticket de caisse ? Il ne pourra pas être récupéré.")) {
    supprimerTicket(db, ticket).catch(signalerErreur);
    $("fenetre-ticket").close();
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
  $("etat-robot").textContent = robot.message || dateDesPromos();
  $("cle-robot").hidden = true;
  $("champ-cle").value = "";
  afficherMessage($("message-robot"), "");
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

// ---------------------------------------------------------------------------------------------
// « Mettre à jour les promos » : lancer le robot sans attendre son passage du matin (voir robot.js)

async function cleDuRobot() {
  if (robot.cle === undefined) robot.cle = await lireCleRobot(db).catch(() => null);
  return robot.cle;
}

const dateDesPromos = () =>
  etat.promos ? `Promos mises à jour ${formaterMoment(new Date(etat.promos.donnees.mise_a_jour))}.` : "";

$("lancer-robot").addEventListener("click", async () => {
  afficherMessage($("message-robot"), "");
  if (robot.suivi) {
    // Il travaille déjà : on montre où il en est.
    $("fenetre-compte").close();
    ouvrirAvancee();
    return;
  }
  const cle = await cleDuRobot();
  if (!cle) {
    demanderCle();
    return;
  }
  $("fenetre-compte").close();
  demarrerRobot(cle);
});

function demanderCle(message) {
  if (!$("fenetre-compte").open) $("bouton-compte").click();
  $("creer-cle").href = ADRESSE_NOUVELLE_CLE;
  $("cle-robot").hidden = false;
  if (message) afficherMessage($("message-robot"), message, "erreur");
  $("champ-cle").focus();
}

async function enregistrerCle() {
  const cle = $("champ-cle").value.trim();
  if (!cleValide(cle)) {
    afficherMessage($("message-robot"), "Ce n'est pas une clé GitHub : elle commence par « github_pat_ ».", "erreur");
    return;
  }
  robot.cle = cle;
  $("champ-cle").value = "";
  $("cle-robot").hidden = true;
  afficherMessage($("message-robot"), "");
  enregistrerCleRobot(db, cle).catch(signalerErreur); // gardée pour les deux téléphones
  $("fenetre-compte").close();
  demarrerRobot(cle);
}

$("enregistrer-cle").addEventListener("click", enregistrerCle);
// « Entrée » dans le champ de la clé : l'enregistrer (et non enregistrer le prénom et fermer).
$("champ-cle").addEventListener("keydown", (evenement) => {
  if (evenement.key !== "Enter") return;
  evenement.preventDefault();
  enregistrerCle();
});

/** Lance le robot (sauf s'il travaille déjà), puis suit son passage jusqu'au bout, étape par étape. */
async function demarrerRobot(cle) {
  Object.assign(robot, { passage: null, details: null, chargement: "a_venir", lance: new Date() });
  ouvrirAvancee();
  try {
    const avant = await dernierPassage(cle);
    if (avant?.etat === "en_cours") {
      suivreRobot(cle, avant.id);
    } else {
      await lancerRobot(cle);
      suivreRobot(cle, null, avant?.id);
    }
  } catch (erreur) {
    $("fenetre-robot").close();
    nouvelleDuRobot("");
    if (erreur instanceof ErreurRobot && erreur.raison === "cle") demanderCle(erreur.message);
    else afficherMessage($("bandeau"), erreur.message || "Le robot n'a pas pu être lancé.", "erreur");
  }
}

/**
 * Suit le passage `id` (déjà en cours), ou celui qui vient d'être demandé : le premier qui n'est pas
 * `precedent` (GitHub met quelques secondes à le créer). Toutes les 10 secondes : ses étapes, et la
 * dernière nouvelle du robot (« Photos : 312 sur 1 450 »).
 */
function suivreRobot(cle, id, precedent) {
  clearTimeout(robot.suivi);
  const etape = async () => {
    try {
      const passage = await dernierPassage(cle);
      if (passage && (id ? passage.id === id : passage.id !== precedent)) {
        robot.passage = passage;
        robot.details = await detailsDuPassage(cle, passage).catch(() => robot.details);
        if (passage.etat !== "en_cours") {
          await finDuRobot(cle, passage);
          return;
        }
      }
    } catch (erreur) {
      console.warn("Robot : pas de nouvelles pour l'instant.", erreur); // on réessaie
    }
    dessinerAvancee();
    robot.suivi = setTimeout(etape, ATTENTE_ROBOT);
  };
  robot.suivi = setTimeout(etape, 0);
  dessinerAvancee();
}

async function finDuRobot(cle, passage) {
  robot.suivi = null;
  if (passage.etat === "reussi") {
    // Les promos que le robot vient d'écrire, sans attendre la copie de GitHub (5 minutes).
    robot.chargement = "en_cours";
    dessinerAvancee();
    const adresse =
      import.meta.env.MODE === "emulateurs" ? ADRESSE_PROMOS : await adressePromosFraiches(cle).catch(() => undefined);
    await chargerPromos(adresse);
    robot.chargement = "fait";
  }
  dessinerAvancee();
  const message = robot.message;
  setTimeout(() => {
    if (!robot.suivi && robot.message === message) nouvelleDuRobot("");
  }, 10_000);
}

/** Les étapes à montrer : celles du robot sur GitHub, puis l'arrivée des promos dans l'appli. */
function etapesDuRobot() {
  const passage = robot.passage ?? { etat: "en_cours", debut: robot.lance };
  const phases = avanceeDuPassage(passage, robot.details ?? {});
  if (!robot.passage) phases[0].detail = "Demande envoyée à GitHub…";
  phases.push({
    titre: "Nouvelles promos dans l'appli",
    etat: passage.etat === "echoue" ? "a_venir" : robot.chargement,
    duree: null,
    detail: null,
  });
  return { passage, phases };
}

const ETATS_ETAPE = { fait: "terminé", en_cours: "en cours", a_venir: "à venir", echoue: "en panne" };
const ICONES_ETAPE = {
  fait: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4L18 8" /></svg>',
  echoue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>',
  en_cours: "",
  a_venir: "",
};

/** La fenêtre « Mise à jour des promos », le bandeau en haut de la liste et la ligne de « Mon compte ». */
function dessinerAvancee() {
  const { passage, phases } = etapesDuRobot();
  const maintenant = new Date();
  const enCours = phases.find((phase) => phase.etat === "en_cours");
  const enPanne = phases.some((phase) => phase.etat === "echoue") || passage.etat === "echoue";
  const fini = robot.chargement === "fait";

  $("etapes-robot").replaceChildren(
    ...phases.map(({ titre, etat, duree, detail }) => {
      const ligne = element("li", "etape-robot");
      ligne.dataset.etat = etat;
      const icone = element("span", "icone-etape");
      icone.innerHTML = ICONES_ETAPE[etat];
      const textes = element("div", "textes-etape");
      textes.append(element("span", "titre-etape", titre), element("span", "cache", ` : ${ETATS_ETAPE[etat]}`));
      if (detail) textes.append(element("span", "detail-etape", detail));
      ligne.append(icone, textes);
      if (duree != null && etat !== "a_venir") ligne.append(element("span", "duree-etape", formaterDuree(duree)));
      return ligne;
    }),
  );
  const depuis = passage.debut ?? robot.lance;
  $("resume-robot").textContent = enPanne
    ? "Le robot s'est arrêté : les promos d'avant restent affichées."
    : fini
      ? `Terminé en ${formaterDuree(Math.max(0, passage.fin - passage.debut))} : les promos sont à jour.`
      : `Commencé il y a ${formaterDuree(Math.max(0, maintenant - depuis))}.`;
  $("lien-passage").hidden = !passage.adresse;
  if (passage.adresse) $("lien-passage").href = passage.adresse;

  if (enPanne) nouvelleDuRobot("Le robot n'a pas réussi à mettre les promos à jour.", "erreur");
  else if (fini) nouvelleDuRobot("Promos mises à jour.", "succes");
  else nouvelleDuRobot(`Mise à jour des promos — ${enCours?.detail ?? enCours?.titre ?? "…"}`);
}

/** Ce que fait le robot, en une ligne : dans « Mon compte » et en haut de la liste. */
function nouvelleDuRobot(message, genre = "info") {
  robot.message = message;
  robot.genre = genre;
  $("etat-robot").textContent = message || dateDesPromos();
  dessinerEtatPromos();
}

function ouvrirAvancee() {
  dessinerAvancee();
  if (!$("fenetre-robot").open) $("fenetre-robot").showModal();
  // Les durées avancent chaque seconde pendant qu'on regarde.
  clearInterval(robot.horloge);
  robot.horloge = setInterval(() => {
    if (robot.suivi) dessinerAvancee();
  }, 1000);
}

$("fenetre-robot").addEventListener("close", () => clearInterval(robot.horloge));

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
