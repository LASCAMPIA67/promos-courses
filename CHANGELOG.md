# Journal des versions

Toutes les évolutions notables du projet sont notées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros de version
suivent le [versionnage sémantique](https://semver.org/lang/fr/) (`MAJEUR.MINEUR.CORRECTIF`) :

- **MAJEUR** : changement qui casse la compatibilité (par exemple, un nouveau format de `promos.json`
  que l'ancienne appli ne sait pas lire) ;
- **MINEUR** : nouvelle fonctionnalité compatible (une nouvelle source, un nouveau champ…) ;
- **CORRECTIF** : correction d'un problème, sans nouveauté.

Tant que le projet est en `0.x`, il est en construction : le format peut encore évoluer.

## [Non publié]

### Ajouté

- **Appli 0.6 : toutes les promos dans l'appli.** Barre d'onglets en bas de l'écran (« Liste » et
  « Promos ») ; l'onglet « Promos » permet de chercher un produit ou une marque pendant qu'on tape
  (le début d'un mot suffit), de filtrer par magasin, et d'ajouter une promo à la liste en un geste,
  avec une note qui rappelle le magasin, le prix et la date. Affichage par 30, « Voir plus de promos ».
- **Supprimer d'un geste** : glisser un article vers la gauche fait apparaître un bouton
  « Supprimer », comme dans Mail sur l'iPhone ; « Annuler » le remet pendant 6 secondes (même s'il
  était dans le caddie). La suppression depuis la fiche de l'article reste possible.
- **Familles de produits** (environ 50) : « Chips » trouve aussi Pringles, Lay's, Doritos… ;
  « Soda » trouve Coca-Cola, Fanta… ; « Couches » trouve « Changes bébé » Pampers… Dans la liste
  comme dans l'onglet « Promos » ; les promos qui contiennent le mot écrit passent d'abord.
- Les faux amis ne se confondent plus : « pâtes » ne trouve pas « pâté », ni « glaces » les
  « marrons glacés ».
- Tests : 11 tests de logique et 4 scénarios réels de plus ; captures d'écran de l'onglet « Promos »
  et du glissement.

### Sécurité

- La clé Firebase de l'appli ne marche plus que depuis l'adresse de l'appli (et la page « Mot de
  passe oublié » de Firebase) : réglage fait dans la console Google Cloud et vérifié, documenté dans
  [docs/liste-commune.md](docs/liste-commune.md#la-clé-de-lappli-limitée-à-son-adresse).
- Le deuxième compte du foyer a été recréé avec la bonne adresse e-mail (l'ancien est supprimé) :
  son identifiant est remplacé dans les règles d'accès et dans les tests.

## [0.5.0] - 2026-10-27

### Ajouté

- **Appli 0.5 : prête à installer sur l'iPhone.** Dans Safari sur iPhone ou iPad, un encadré explique
  comment ajouter l'appli à l'écran d'accueil (« Plus tard » le cache pour 14 jours).
- Mises à jour automatiques de l'appli installée : elle vérifie à chaque ouverture si une nouvelle
  version est publiée et la prend d'elle-même, sans recharger pendant qu'on écrit.
- Guide pas à pas : [docs/installation-iphone.md](docs/installation-iphone.md).
- Tests : 4 tests de logique et 2 scénarios réels de plus (conseil d'installation), capture d'écran.
- **Version en test publiée automatiquement** dans les « Releases » comme pré-version
  (« Version X.Y.Z (en test) »), remise à jour à chaque changement ; elle devient la version
  définitive (« Latest ») une fois validée. Badge « en test » dans le README.

### Modifié

- README : les cinq étapes du projet sont faites et validées ; l'appli est installée sur nos deux
  iPhones.

## [0.4.0] - 2026-10-27

### Ajouté

- **Appli 0.4 : la liste comparée aux promos.** Les articles en promo chez Lidl ou Leclerc portent une
  étiquette « 2 promos » ; en la touchant, le détail de chaque promo : magasin, prix, ancien prix,
  réduction, prix au kilo, prix par lot, carte de fidélité, dates (promos en cours et à venir), lien
  vers le catalogue. Le nombre d'articles en promo s'affiche en haut de la liste.
- Recherche des promos qui ignore majuscules, accents et pluriel (« Œufs » trouve « 20 oeufs frais »),
  sans confondre deux mots proches (« Lait » ne trouve pas « Laitue »).
- Promos gardées sur le téléphone pour fonctionner sans réseau ; bandeau si elles sont trop anciennes
  (robot pas passé depuis plus de 36 heures), si un magasin manque ou si elles sont indisponibles.
- Tests : 21 tests de logique et 3 scénarios réels de plus (promos d'exemple aux dates du jour).
- Captures d'écran des promos (modes clair et sombre).

### Modifié

- Robot : rattrapages à 8 h 17 et 12 h 37 (heure de Paris) si GitHub n'a pas lancé le robot à 5 h 47,
  comme le 27/10/2026. Un lancement programmé ne fait rien si le robot a déjà été lancé dans la
  journée, à la main ou par un autre horaire : toujours un seul passage par jour sur les sites.
- Notes des versions : les liens vers la documentation marchent sur la page de chaque version, et
  le workflow « Publication » lancé à la main remet à jour les notes d'une version déjà publiée.

## [0.3.0] - 2026-10-27

### Ajouté

- Liste de courses commune : projet Firebase (offre gratuite Spark), règles d'accès Firestore
  réservées aux deux comptes du foyer, 15 tests sur l'émulateur Firebase et workflow « Règles Firebase ».
- Documentation de la liste commune : [docs/liste-commune.md](docs/liste-commune.md).
- **Appli web (version 0.3)** pour l'iPhone, publiée sur GitHub Pages : connexion, liste de courses
  commune synchronisée en direct, ajout rapide avec quantité, doublons signalés, caddie, modification
  et suppression, fonctionnement sans réseau, mode sombre, icônes, installable (PWA).
- Tests de l'appli : logique (Vitest) et scénarios réels sur l'émulateur Firebase avec deux comptes,
  dans Chrome et Safari (Playwright) ; workflow « Appli » qui teste puis publie.
- Documentation de l'appli avec captures d'écran : [docs/appli.md](docs/appli.md).

### Modifié

- Les versions courtes (« express ») des catalogues Leclerc sont signalées dans leur nom.
- Outils GitHub mis à jour (proposés par Dependabot) : `actions/checkout` v7, `actions/setup-python` v7,
  `actions/setup-node` v7, `actions/setup-java` v6, `actions/upload-artifact` v7,
  `actions/upload-pages-artifact` v5, `actions/deploy-pages` v5 et `@playwright/test` 1.64.1.
- README : étapes 3 et 4.1 validées, section « Licence » (aucune licence : tous droits réservés).

## [0.2.0] - 2026-10-26

### Ajouté

- Source **E.Leclerc Geispolsheim** : tous les catalogues du magasin (n° 1067), lus depuis le service
  officiel des catalogues Leclerc. Gère les prix barrés, les « 2e à -X % », les « 2 + 1 offert »,
  les « Ticket E.Leclerc » sur la carte de fidélité et les offres sur toute une marque.
- Source **Lidl Lingolsheim** complète : lecture du prospectus PDF officiel de la semaine en cours et
  de la suivante (alimentaire compris), avec ancien prix, réduction, Lidl Plus, prix au kilo,
  lots et dates de chaque page.
- Champ `lot` (prix quand on en achète plusieurs) et prix au kilo, au litre ou à la pièce.
- Réutilisation des catalogues inchangés : le robot ne retélécharge un catalogue que s'il a changé.
- Vérification de `promos.json` avec un schéma JSON avant chaque enregistrement.
- Nouvelles tentatives automatiques en cas de panne passagère d'un site.
- Tests automatiques (pytest), vérification du style (ruff) et workflow « Tests ».
- Publication automatique des versions (workflow « Publication », dès que le numéro de version change) et mises à jour par Dependabot.
- Documentation : README détaillé, format de `promos.json`, sources, guide de contribution.

### Modifié

- **Format de `promos.json` passé en version 2** (champs `format`, `version_robot`, `catalogue`,
  `lot`, `ean`, `page`, catalogues de chaque source). Voir [docs/format-promos.md](docs/format-promos.md).
- Le robot devient un paquet Python (`src/robot_promos`), lancé avec `python -m robot_promos`.

### Supprimé

- Magasins **dm** et **Lidl Kehl** (Allemagne), et Auchan prévu à l'origine : le projet se concentre
  sur Lidl Lingolsheim et E.Leclerc Geispolsheim.
- Sources Marktguru, Kaufda et Bonial (remplacées par les sources officielles, plus complètes).

## [0.1.0] - 2026-10-26

### Ajouté

- Premier robot : Lidl France (Bonial, prospectus non alimentaire), Lidl Allemagne (Marktguru) et
  dm (Kaufda).
- Lancement automatique chaque jour vers 5 h 45 (heure de Paris) et à la demande.
- Fichier `promos.json` (format 1).
- Version antérieure à la mise en place des publications : pas de page « Release » (voir le lien
  ci-dessous vers son enregistrement d'origine).

[Non publié]: https://github.com/lascampia67/promos-courses/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/lascampia67/promos-courses/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/lascampia67/promos-courses/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/lascampia67/promos-courses/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/lascampia67/promos-courses/compare/ad703c7...v0.2.0
[0.1.0]: https://github.com/lascampia67/promos-courses/commit/ad703c7
