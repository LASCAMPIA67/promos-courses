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

## [0.12.0] - 2026-10-28

### Ajouté

- **« Mettre à jour les promos »** (Mon compte → Promos) : lance le robot sans attendre son passage du
  matin (GitHub le lance parfois avec plusieurs heures de retard), suit son avancée (« Le robot
  travaille depuis 4 min… », en haut de la liste aussi) et recharge les promos dès qu'il a fini,
  directement depuis ce qu'il vient d'écrire (sans la copie de 5 minutes de GitHub). S'il travaille
  déjà, l'appli suit ce passage au lieu d'en lancer un autre. Il faut une fois une clé GitHub
  « fine-grained » limitée à ce dépôt et au droit « Actions » (un an) : l'appli ouvre la page de
  GitHub déjà remplie, puis garde la clé dans Firebase (`reglages/robot`) pour les deux téléphones,
  jamais dans ce dépôt. Clé refusée ou expirée : l'appli le dit et en demande une nouvelle.
- **L'avancée du robot, étape par étape** : la fenêtre « Mise à jour des promos » s'ouvre au
  lancement et montre Démarrage, Lecture des catalogues Leclerc, Photos des produits,
  Enregistrement et Nouvelles promos dans l'appli : cochées quand elles sont finies (avec leur
  durée), en cours, à venir ou en panne, avec la dernière nouvelle du robot (« Catalogue 3 sur 9 :
  Un automne en fête », « Photos : 312 sur 1 450 (12 nouvelles) ») et un lien vers le passage sur
  GitHub. Fenêtre fermée, une ligne en haut de la liste suit le robot (« Voir l'avancée »). Le
  robot écrit ces nouvelles dans un statut GitHub (`robot-promos/avancee`, au plus toutes les 10
  secondes) ; ses étapes sont séparées dans le workflow (« Lire les catalogues », « Fabriquer les
  photos » lancé à part avec `python -m robot_promos.photos`, « Enregistrer les promos »…), et un
  test vérifie que l'appli connaît leurs noms exacts. Une panne pendant les photos n'empêche plus
  d'enregistrer les promos.
- Règles d'accès : `reglages/robot` n'accepte qu'une clé `github_pat_…`, sans autre champ.

### Modifié

- L'appli ne remplace jamais ses promos par une copie plus ancienne (GitHub sert parfois une copie
  de quelques minutes).

## [0.11.0] - 2026-10-28

### Ajouté

- **Une photo pour chaque promo** : à gauche de chaque fiche (résultats quand on écrit un article,
  fenêtre « Promo pour… »), la photo du produit. Elle vient du catalogue officiel Leclerc et n'est
  gardée que si elle est sûre : la photo du produit seul (jamais une photo d'ambiance), qui porte
  le code-barres du produit ou exactement son nom. Sinon, un emplacement neutre : produits frais,
  promos sur toute une marque, photo introuvable. Le robot fait une fois pour toutes une petite
  vignette (256 pixels, une quinzaine de Ko au lieu de 2 à 6 Mo), rangée dans la branche `photos`
  du dépôt, réécrite à chaque passage (pas d'historique). L'appli les garde pour les voir sans
  réseau. Nouveau champ facultatif `photo` dans `promos.json` (format inchangé, toujours `2`).

### Corrigé

- Le robot prenait la première image du catalogue, parfois une photo d'ambiance (un plat) au lieu
  du produit : 32 promos concernées. Chaque catalogue est relu une fois pour corriger.
- Les captures d'écran de la documentation sont prises sans animation (une fenêtre n'est plus
  capturée en train de s'ouvrir).

## [0.10.0] - 2026-10-28

### Ajouté

- **Lecture automatique des tickets de caisse** : en ajoutant un ticket, l'appli trouve le magasin,
  la date et le total et remplit la fenêtre (« Date et total lus sur le ticket : vérifiez. »). Un
  PDF de l'appli E.Leclerc est lu aussitôt (son texte, avec PDF.js) ; une photo ou une
  capture d'écran en quelques secondes, avec [Tesseract.js](https://tesseract.projectnaptha.com) en
  français. Tout se passe sur le téléphone : rien n'est envoyé ailleurs, et les fichiers de lecture
  (environ 4 Mo) sont servis par l'appli, téléchargés à la première lecture puis gardés pour marcher
  sans réseau. Ce qu'on a changé à la main n'est jamais remplacé, on peut enregistrer sans attendre,
  et la lecture s'arrête si on ferme la fenêtre. Faux totaux (sous-total, remises, TVA) et dates
  impossibles écartés ; testé sur une photo et un PDF d'exemple, dans Chrome et Safari.

### Modifié

- **Les fiches de promo n'affichent plus le nom du magasin** : il n'y en a plus qu'un. La première
  ligne dit seulement jusqu'à quand dure la promo.
- **Tickets de caisse** : le magasin se choisit entre « Leclerc » (d'office) et « Autre ». Les règles
  d'accès Firebase (`firebase/firestore.rules`) n'acceptent plus que ces deux valeurs.
- La recherche des promos ne range plus par magasin : les plus proches d'abord, celles en cours avant
  celles à venir.

### Corrigé

- **Une même promo affichée deux fois** (« Sirop pêche zéro » Fruit Shoot et Teisseire) : elle
  paraissait dans deux catalogues avec la marque écrite différemment. Le robot reconnaît maintenant
  une même promo à son code-barres (même prix, mêmes dates), quelle que soit la marque écrite ; le
  fichier des promos du jour est corrigé. Ajouter l'une ne fait donc plus croire que l'autre est
  « Dans la liste ».
- Description d'une promo : plus de « · . » mal placé (« 60 cl · Existe aussi : Différentes
  variétés »).

### Supprimé

- **Lidl Lingolsheim est retiré du projet** : nous ne faisons nos courses que chez E.Leclerc
  Geispolsheim. Le robot ne lit plus le prospectus Lidl (modules `lidl.py` et `lidl_pdf.py`, leurs
  tests, et la bibliothèque `pdfplumber` qui ne servait qu'à eux) ; `promos.json` ne contient plus
  que les promos Leclerc (le schéma n'accepte plus que `leclerc` et `leclerc-geispolsheim`). Dans
  l'appli : plus de prix « Lidl Plus », plus de « Leclerc avant Lidl », plus de choix « Lidl » pour
  un ticket ; les marques propres de Lidl sont retirées des familles de produits. Le format de
  `promos.json` ne change pas (toujours `2`) : une ancienne appli lit le nouveau fichier sans souci.

## [0.9.0] - 2026-10-27

### Ajouté

- **La liste rangée par rayon**, dans l'ordre où on traverse le magasin (fruits et légumes,
  boulangerie, épiceries, boissons, hygiène, entretien, bébé, animaux, viande et poisson, frais, et
  le surgelé en dernier). Le rayon est deviné d'après le nom de l'article et les familles de
  produits ; un rayon mal deviné se change dans la fenêtre de l'article et c'est retenu pour le
  foyer (réglage `reglages/rayons`).
- **Des gestes doux** : un article coché ou supprimé glisse et s'efface, celui qui arrive apparaît en
  douceur, les fenêtres s'ouvrent en fondu (rien si « Réduire les animations » est activé).
- **Une jolie ouverture** : écrans de démarrage de l'iPhone (logo sur fond clair ou sombre, toutes
  les tailles depuis l'iPhone X et le SE), puis la liste en fondu.
- **Contrôle qualité automatique** : chaque écran est vérifié avec axe (accessibilité WCAG 2.2 AA,
  mode clair et sombre) dans les scénarios réels, et l'appli construite est mesurée avec Lighthouse
  (rapidité 93 à 97 sur 100, accessibilité et bonnes pratiques 100) à chaque modification.

### Corrigé

- Accessibilité : textes verts plus contrastés (liens, « Tout retirer », type de promo en mode
  sombre) ; ce que lit VoiceOver commence par le texte affiché (articles, étiquette « Promo »,
  tickets) ; le choix du fichier d'un ticket a un nom.

### Modifié

- En bas de la liste, seule la version de l'appli reste : la phrase « Promos : aujourd'hui à… » est
  retirée (un bandeau prévient toujours si les promos sont trop anciennes).

## [0.8.0] - 2026-10-27

### Ajouté

- **Appli 0.8 : les tickets de caisse.** En bas de la liste, « Tickets de caisse » garde les
  tickets en photo, en capture d'écran ou en PDF (celui de l'appli E.Leclerc ou Lidl Plus), avec le
  magasin, la date des courses, et si on veut le montant et une note. Les 3 derniers sont sous la
  liste, tous les autres dans « Voir les tickets », par mois. Un ticket s'ouvre en grand (photo, ou
  chaque page du PDF), se partage (Enregistrer dans Fichiers, Mail…), se corrige ou se supprime.
  Après « Tout retirer », l'appli propose d'ajouter le ticket des courses. Marche sans réseau.
- Les photos sont allégées avant l'envoi (1 400 pixels de large, JPEG, 200 à 400 Ko) ; les PDF sont
  gardés tels quels (5 Mo au plus). Affichage des PDF avec PDF.js, chargé seulement à l'ouverture
  d'un PDF. Voir [docs/appli.md](docs/appli.md#les-tickets-de-caisse).
- Tickets gardés dans Firestore, sur l'offre gratuite (collection `tickets`, fichier découpé en
  morceaux de moins de 1 Mio), jamais dans ce dépôt : voir
  [docs/liste-commune.md](docs/liste-commune.md#collection-tickets--les-tickets-de-caisse).
- **La promo choisie, dans la liste** : un article ajouté depuis une promo (« + Ajouter ») garde
  cette promo (son identifiant, nouveau champ `promo` de l'article). À droite, une étiquette
  « Promo » et dessous, en petit, son type, sans avoir à l'ouvrir : « -60 % sur le 2e », « -20 % en
  caisse », « 30 % sur la carte », « -25 % avec la carte », « -23 % Lidl Plus », ou le prix ; « dès
  le 29 oct. » pour une promo à venir ; « Promo terminée » quand elle n'est plus dans les catalogues.
  Les articles ajoutés ainsi par les versions précédentes la retrouvent d'après leur note.
- Tests : 18 tests de logique, 7 tests des règles et 7 scénarios réels de plus ; captures.

### Modifié

- **Un article écrit à la main n'affiche plus de promo** (l'étiquette « 2 promos » qui comparait
  chaque article à toutes les promos est retirée) : seule la promo choisie avec « + Ajouter »
  s'affiche. Pour voir les promos d'un article, il suffit de l'écrire dans le champ.
- **Plus de doublons** : une même promo déclinée en plusieurs produits (« Au choix : Douceur,
  Nutrition, Purifiant… »), que le catalogue Leclerc donne en plusieurs offres, n'est montrée qu'une
  fois, dans la liste comme pendant qu'on écrit.
- **Fiches de promo plus compactes**, rangées pour se lire d'un coup d'œil : magasin et dates
  (« Jusqu'au sam. 31 oct. », « Dès jeu. 29 oct. »), produit, taille sur une ligne, prix (avec
  « + Ajouter » ou « Catalogue » à droite), puis le type de promo dans une pastille de couleur
  (« -40 % en caisse », « 30 % sur la carte »…) et le détail utile (« 9,18 € les 2 », « revient à
  1,65 € »). Les grands encadrés et les mentions répétées sont retirés.
- **Liste allégée** : l'heure d'ajout seule pour aujourd'hui (« 13:38 ») ; la note d'une promo
  ajoutée ne garde que le magasin et le prix (« Lidl · 0,89 € »), y compris pour les notes écrites
  par les versions précédentes.

### Sécurité

- Règles d'accès : un article peut porter l'identifiant de sa promo (`promo`, 100 caractères au
  plus) ; la collection `tickets` n'accepte que des fiches de la bonne forme ; le fichier
  d'un ticket ne peut plus être changé une fois envoyé, et chaque morceau doit appartenir à un
  ticket existant, sans dépasser le nombre prévu ni 900 000 octets.

## [0.7.0] - 2026-10-27

### Ajouté

- **Appli 0.7 : qui a ajouté quoi, et quand.** Une petite pastille de couleur, sous le rond à
  cocher, dit qui a ajouté l'article (même si son nom est long) ; sous le nom, la date et l'heure
  d'ajout (« aujourd'hui 13:38 », « hier 08:05 », « jeu. 09:15 », « 12/10 09:15 »). La fenêtre d'un article le rappelle (« Ajouté par …, … »).
- **Mon compte** : chacun écrit son prénom et choisit sa couleur parmi six, avec une légende qui
  rappelle qui a quelle couleur. Les fiches sont dans Firebase (nouvelle collection `membres`),
  jamais dans ce dépôt ; sans fiche, une couleur est donnée d'office.
- Tests : 5 tests de logique, 4 tests des règles et 1 scénario réel de plus ; capture « Mon compte ».
- **Qualité du code**, d'après les documentations officielles : ESLint (avec les règles de
  Playwright pour les scénarios) et Prettier pour l'appli et les tests des règles, vérifiés sur
  GitHub ; règles Ruff étendues pour le robot (sécurité, dates, simplifications, pytest) ; version de
  Node.js notée dans `.nvmrc`. Voir [CONTRIBUTING.md](CONTRIBUTING.md#qualité-et-sécurité-du-code).
- **Analyse de sécurité CodeQL** (Python, JavaScript et workflows), chaque semaine et à chaque
  modification.

### Modifié

- **Moins de texte, l'essentiel seulement** : plus de phrase sous « Liste de courses » (nombre
  d'articles et de promos) ; en bas, une seule ligne discrète « Promos : aujourd'hui à 5 h 48 ·
  v0.7.0 » ; explications des prix, messages et note d'une promo ajoutée raccourcis
  (« Lidl · 0,89 € · jusqu'au 31 oct. ») ; le résumé en haut des promos d'un article est retiré.

### Sécurité

- Règles d'accès : la collection `membres` n'accepte que le prénom (1 à 30 caractères) et une des
  six couleurs, et chacun ne peut écrire que sa propre fiche.
- Workflows GitHub : actions fixées sur un commit précis, droits du jeton réduits au nécessaire pour
  chaque travail, jeton git non conservé quand il ne sert pas, valeur saisie à la main passée par une
  variable d'environnement.

## [0.6.0] - 2026-10-27

### Ajouté

- **Appli 0.6 : les promos en écrivant.** En écrivant un article, les promos qui correspondent
  s'affichent aussitôt sous le champ, à la place de la liste (le début d'un mot suffit, dès 2
  lettres) ; « + » ou « OK » ajoute ce qui est écrit, qu'il y ait des promos ou non, et le bouton
  d'une promo ajoute ce produit avec une note qui rappelle le magasin, le prix et la date. Affichage
  par 30, « Voir plus de promos ». Un seul écran, sans onglets.
- **Leclerc d'abord** : à pertinence égale, les promos de Leclerc (notre magasin principal) passent
  avant celles de Lidl.
- **Prix en clair** : chaque promo dit où va la réduction, dans un encadré de couleur : déjà déduite
  du prix (« Réduction en caisse »), en prenant plusieurs (« -50 % sur le 2e : 9,18 € les 2 »),
  rendue sur la carte E.Leclerc (Ticket E.Leclerc : prix payé en caisse, montant rendu et prix
  final), avec la carte E.Leclerc, ou avec l'appli Lidl Plus (et le prix sans l'appli).
- **Fiches de promo plus lisibles** : la description ne répète plus les prix (« 272 g ·
  Goût nature… » au lieu de « 272 g.Le kg : 9,38 €.Par 2 (544 g) : 3,57 € au lieu de 5,10 € ») ; la
  marque suit le nom ; le prix au kilo est à côté du prix.
- **Supprimer d'un geste** : glisser un article vers la gauche fait apparaître un bouton
  « Supprimer », comme dans Mail sur l'iPhone ; « Annuler » le remet pendant 6 secondes (même s'il
  était dans le caddie). La suppression depuis la fiche de l'article reste possible.
- **Familles de produits** (48) : « Chips » trouve aussi Pringles, Lay's, Doritos… ; « Soda » trouve
  Coca-Cola, Fanta… ; « Couches » trouve « Changes bébé » Pampers… Pour les étiquettes de la liste
  comme pour les promos affichées en écrivant ; les promos qui contiennent le mot écrit passent
  d'abord.
- Les faux amis ne se confondent plus : « pâtes » ne trouve pas « pâté », ni « glaces » les
  « marrons glacés ».
- Tests : 20 tests de logique et 5 scénarios réels de plus ; captures d'écran.

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

[Non publié]: https://github.com/lascampia67/promos-courses/compare/v0.12.0...HEAD
[0.12.0]: https://github.com/lascampia67/promos-courses/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/lascampia67/promos-courses/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/lascampia67/promos-courses/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/lascampia67/promos-courses/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/lascampia67/promos-courses/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/lascampia67/promos-courses/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/lascampia67/promos-courses/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/lascampia67/promos-courses/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/lascampia67/promos-courses/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/lascampia67/promos-courses/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/lascampia67/promos-courses/compare/ad703c7...v0.2.0
[0.1.0]: https://github.com/lascampia67/promos-courses/commit/ad703c7
