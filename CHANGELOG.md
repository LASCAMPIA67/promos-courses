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

[Non publié]: https://github.com/lascampia67/promos-courses/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/lascampia67/promos-courses/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/lascampia67/promos-courses/releases/tag/v0.1.0
