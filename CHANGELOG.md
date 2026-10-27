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

[Non publié]: https://github.com/lascampia67/promos-courses/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/lascampia67/promos-courses/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/lascampia67/promos-courses/compare/ad703c7...v0.2.0
[0.1.0]: https://github.com/lascampia67/promos-courses/commit/ad703c7
