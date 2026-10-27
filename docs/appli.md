# L'appli

L'appli est une **application web** pensée pour l'iPhone : elle s'ouvre dans Safari et s'installe
sur l'écran d'accueil comme une vraie appli ([guide d'installation](installation-iphone.md)). Elle est publiée gratuitement par
GitHub Pages à l'adresse :

**https://lascampia67.github.io/promos-courses/**

Seuls nos deux comptes peuvent s'y connecter et voir la liste (voir
[liste-commune.md](liste-commune.md)).

| Connexion | Liste | Promos d'un article | En écrivant un article | Modifier un article | Mon compte | Mode sombre |
|---|---|---|---|---|---|---|
| ![Écran de connexion](captures/connexion.png) | ![Liste de courses : une pastille de couleur par personne et l'heure d'ajout](captures/liste.png) | ![Les promos du lait chez Lidl et Leclerc](captures/promos.png) | ![Recherche « lait » dans toutes les promos](captures/recherche.png) | ![Modifier un article : qui l'a ajouté et quand](captures/modifier.png) | ![Choisir son prénom et sa couleur](captures/compte.png) | ![Liste en mode sombre](captures/liste-sombre.png) |

Les captures sont faites avec des promos d'exemple et des prénoms fictifs (Camille en vert, Alex en orange).

## Ce qu'elle sait faire (version 0.8)

- **Se connecter** avec son e-mail et son mot de passe (une seule fois : la connexion reste active).
  Lien « Mot de passe oublié ? » pour recevoir un e-mail de changement de mot de passe.
- **Ajouter un article** : écrire le nom (et, si on veut, la quantité), puis toucher **+** ou
  « OK » sur le clavier. Un article déjà dans la liste est signalé au lieu d'être ajouté en double
  (même écrit différemment : « Lait demi-écrémé » = « lait demi ecreme »).
- **Cocher** un article (le rond à gauche) : il passe dans « Dans le caddie ». Le décocher le remet
  dans la liste.
- **Qui l'a ajouté, et quand** : sous le rond à cocher, une petite **pastille de couleur** dit qui
  a ajouté l'article ; sous le nom, la date et l'heure d'ajout (« 13:38 » aujourd'hui, « hier 08:05 »,
  « jeu. 09:15 » cette semaine, « 12/10 09:15 » avant), puis la quantité et la note.
- **Mon compte** (le bonhomme en haut à droite) : chacun écrit son **prénom** et choisit **sa
  couleur** parmi six ; la légende dessous rappelle qui a quelle couleur. Tant qu'un compte n'a pas
  choisi, il a une couleur donnée d'office (la même sur les deux téléphones).
- **Modifier** un article (toucher son nom) : nom, quantité, note (« sans lactose »…), ou le supprimer.
  La fenêtre rappelle qui l'a ajouté et quand.
- **Supprimer d'un geste** : glisser l'article vers la gauche, puis toucher **Supprimer** (comme
  dans Mail sur l'iPhone). Pendant 6 secondes, **Annuler** le remet à sa place, même s'il était
  dans le caddie. Toucher la ligne, ou ailleurs, la referme.

  ![Article glissé vers la gauche : le bouton Supprimer apparaît](captures/glisser.png)

- **Tout retirer** : vide d'un coup les articles du caddie, une fois les courses faites.
- **En direct sur les deux téléphones** : ce que l'un fait apparaît aussitôt chez l'autre.
- **Sans réseau** (au fond du magasin) : tout continue de marcher ; un bandeau jaune le signale et
  les changements partent dès que le réseau revient.
- **Voir les promos** de chaque article (voir ci-dessous).
- **Voir les promos en écrivant** un article, et en ajouter une à la liste d'un geste (voir ci-dessous).
- **S'installer sur l'iPhone** : dans Safari, un encadré vert explique comment l'ajouter à l'écran
  d'accueil (« Plus tard » le cache pour 14 jours). Voir [installation-iphone.md](installation-iphone.md).
- **Se mettre à jour toute seule** : à chaque ouverture, elle vérifie si une nouvelle version est
  publiée et la prend, sans jamais recharger pendant qu'on écrit.
- **Garder les tickets de caisse** (voir ci-dessous).
- **Mode sombre** automatique, textes lisibles par VoiceOver, grandes zones à toucher.

## Les tickets de caisse

Les tickets papier finissent souvent à la poubelle : l'appli les garde, pour vérifier un prix ou
retrouver une preuve d'achat (garantie, retour d'un produit). Ils sont rangés **en bas de la
liste**, sous le caddie, et visibles sur les deux téléphones.

| Les derniers tickets, sous la liste | Ajouter un ticket | Un ticket en grand |
|---|---|---|
| ![Les tickets de caisse sous la liste](captures/tickets.png) | ![Ajouter un ticket : aperçu, magasin, date, montant](captures/ajout-ticket.png) | ![Un ticket ouvert en grand](captures/ticket.png) |

- **Ajouter** : « + Ajouter » à côté de « Tickets de caisse ». L'iPhone propose de **prendre une
  photo**, de choisir dans la **photothèque** (une capture d'écran, par exemple celle du ticket dans
  l'appli E.Leclerc ou Lidl Plus) ou dans **Fichiers** (le **PDF** du ticket). Après « Tout retirer »
  dans le caddie, l'appli propose aussi d'ajouter le ticket des courses.
- **Ce qu'on indique** : le magasin (Leclerc d'office, ou Lidl si le nom du fichier le dit), la date
  des courses (aujourd'hui d'office), et si on veut le montant et une note (« garantie de la
  cafetière »).
- **Sous la liste** : les 3 derniers tickets (« Leclerc · mar. 27/10 · 54,30 € ») ; « Voir les 12
  tickets » les montre tous, classés par mois.
- **En grand** : toucher un ticket l'ouvre (la photo, ou chaque page du PDF) ; on peut zoomer avec
  deux doigts. **Partager** ouvre la feuille de partage de l'iPhone (Enregistrer dans Fichiers,
  Mail, AirDrop…), avec le fichier d'origine pour un PDF. **Modifier** corrige le magasin, la date,
  le montant ou la note ; **Supprimer** l'efface pour de bon (après confirmation).
- **Photos allégées** : une photo est réduite à 1 400 pixels de large (assez pour lire chaque ligne)
  et enregistrée en JPEG, soit 200 à 400 Ko. Un PDF est gardé tel quel (5 Mo au plus).
- **Sans réseau** : le ticket est gardé sur le téléphone (« envoi en cours… ») et part au retour du
  réseau. Un ticket ajouté par l'autre téléphone s'ouvre une première fois avec du réseau ; ensuite
  il reste sur le téléphone.
- **Privés** : comme la liste, les tickets sont dans Firebase et seuls nos deux comptes y ont accès.
  Ils ne sont **jamais** dans ce dépôt GitHub, qui est public. Voir
  [liste-commune.md](liste-commune.md#collection-tickets--les-tickets-de-caisse).

## Les promos

Chaque matin, le robot range dans [`promos.json`](../promos.json) toutes les promos de Lidl
Lingolsheim et d'E.Leclerc Geispolsheim. L'appli lit ce fichier et le compare à la liste :

- un article **à acheter** qui est en promo porte une étiquette orange **« 2 promos »**, et dessous,
  en petit, le **type de la meilleure promo**, sans avoir à l'ouvrir : « -60 % sur le 2e » (en
  prenant plusieurs), « -20 % en caisse », « 30 % sur la carte » (Ticket E.Leclerc), « -25 % avec
  la carte », « -23 % Lidl Plus », ou le prix s'il n'y a pas de réduction particulière ; « dès le
  29 oct. » s'ajoute pour une promo qui n'a pas encore commencé ;
- en touchant l'étiquette, on voit **chaque promo**, rangée pour se lire d'un coup d'œil :
  1. le magasin (Lidl en jaune, Leclerc en bleu) et **jusqu'à quand** elle dure (« Jusqu'au sam.
     31 oct. », « Dernier jour ») ; une promo **à venir** (catalogue de la semaine suivante) est en
     bleu (« Dès jeu. 29 oct. ») ;
  2. le produit et sa marque ;
  3. sa taille, sur une ligne (« 2 x 300 ml », sans les prix répétés) ;
  4. le prix payé en caisse, l'ancien prix barré, le prix au kilo, et à droite « Catalogue », qui
     ouvre le catalogue officiel ;
  5. le **type de promo**, dans une pastille de couleur, et le détail utile (voir ci-dessous) ;
- une même promo déclinée en plusieurs produits (« Au choix : Douceur, Nutrition, Purifiant… »), que
  le catalogue donne en plusieurs offres, n'est montrée **qu'une fois** ;
- les promos les plus proches de l'article viennent d'abord : pour « Lait », « Lait demi-écrémé »
  passe avant « Chocolat au lait » ; à pertinence égale, **Leclerc passe avant Lidl** (notre magasin
  principal).

### Comprendre le prix : où va la réduction

Sous le prix, une pastille de couleur donne le type de promo, suivie du détail utile. Le gros prix
est toujours celui **payé en caisse**.

| Pastille | Ce que ça veut dire | Détail à côté |
|---|---|---|
| 🟩 **-15 % en caisse** | Le prix affiché est déjà réduit ; l'ancien prix est barré. | |
| 🟩 **-50 % sur le 2e**, **2 + 1 offert** | Le gros prix est celui d'un seul ; la réduction se fait en caisse en prenant le lot. | « 9,18 € les 2 (0,77 €/L) » |
| 🟦 **30 % sur la carte** | Ticket E.Leclerc : on paie le prix affiché en caisse ; une partie revient sur la carte, à dépenser plus tard. | « revient à 1,65 € » |
| 🟦 **-25 % avec la carte** | Réduction en caisse, réservée aux porteurs de la carte E.Leclerc. | |
| 🟨 **-23 % Lidl Plus** | Le prix affiché est celui avec l'appli Lidl Plus, à scanner en caisse. | « sans l'appli : 2,49 € » |

Sans pastille : c'est le prix du catalogue, sans réduction particulière. Le même type de promo est
écrit en petit sous l'étiquette « 2 promos » de la liste.

### Les promos en écrivant un article

Dès 2 lettres écrites dans « Ajouter un article… », les promos qui correspondent s'affichent sous
le champ, à la place de la liste (la croix ✕ efface et fait revenir la liste) :

- les résultats suivent ce qu'on tape, et le début d'un mot suffit (« fro » trouve « Fromage »,
  « nute » trouve les produits Nutella) ; les mots entiers passent d'abord (« lait » montre « Lait
  demi-écrémé » avant « Laitue »), et Leclerc avant Lidl ;
- **« + »** ou **« OK »** sur le clavier ajoute ce qu'on a écrit, **qu'il y ait des promos ou non** ;
- le bouton **« + Ajouter »** d'une promo ajoute ce produit-là, avec une **note** courte qui
  rappelle le magasin et le prix (« Lidl · 0,89 € ») ; le type de promo et ses dates s'affichent,
  toujours à jour, sous l'étiquette de l'article ;
  s'il est déjà dans la liste, le bouton l'indique (« ✓ Dans la liste ») ;
- les promos s'affichent par 30 ; « Voir plus de promos » montre les suivantes.

### Les familles de produits

Beaucoup de produits ne portent pas le nom de ce qu'ils sont : des chips s'appellent « Pringles »
ou « Doritos », un soda « Regular » (Coca-Cola), des couches « Changes bébé ». L'appli connaît donc
des **familles** : écrire « Chips » dans la liste trouve aussi les promos Pringles, Lay's, Doritos,
Vico, Bret's, Crusti Croc…

| On écrit | L'appli trouve aussi |
|---|---|
| Chips | Pringles, Lay's, Doritos, Vico, Bret's, Monster Munch, Crusti Croc (Lidl)… |
| Soda | Coca-Cola, Pepsi, Fanta, Orangina, Oasis, Schweppes, Freeway (Lidl)… |
| Couches | Pampers, Huggies, Lotus Baby, « Changes bébé »… |
| Shampoing | « Shampooing » (les deux orthographes), Elseve, Head & Shoulders… |
| Fromage | Camembert, comté, emmental, Babybel, Kiri, Boursin… |
| Bière, café, eau, chocolat, biscuits, céréales, lessive, dentifrice… | leurs marques les plus courantes |

Les promos qui contiennent le mot écrit passent d'abord, puis celles trouvées par la famille. Il y a
environ 50 familles, dans [`app/src/familles.js`](../app/src/familles.js) : une marque qui manque
peut y être ajoutée (il suffit de la demander). Seules les marques qui ne font qu'une sorte de
produit y sont : « Président » (beurre **et** fromage) n'y est pas, pour ne pas mélanger.

Quelques mots ne se distinguent que par l'accent : « pâtes » ne trouve pas « pâté », ni « glaces »
les « marrons glacés ».

### Bien nommer ses articles

L'appli cherche **tous les mots** de l'article dans le nom du produit ou dans sa marque (ou dans sa
famille, voir ci-dessus), sans tenir compte des majuscules, des accents ni du pluriel :

| Article | Trouve | Ne trouve pas |
|---|---|---|
| « Lait » | « Lait demi-écrémé UHT », « Chocolat au lait » | « Laitue » |
| « Œufs » | « 20 oeufs frais plein air » | |
| « Lait demi-écrémé » | « Lait demi-écrémé UHT » | « Lait de coco » |
| « Nutella » | « Pâte à tartiner » de la marque Nutella | |

Des noms **courts et simples** (« lait », « café », « lessive ») trouvent le plus de promos. Les
détails (« sans lactose », « grand format ») vont mieux dans la **note** de l'article.

### Des promos à jour

- L'appli relit les promos à chaque ouverture (au plus une fois par heure). Tout en bas, une
  ligne discrète rappelle le dernier passage du robot et la version de l'appli
  (« Promos : aujourd'hui à 5 h 48 · v0.7.0 »).
- **Sans réseau**, elle utilise les dernières promos lues.
- Un **bandeau jaune** prévient si les promos ont plus de 36 heures (le robot a manqué un passage :
  voir le [dépannage du README](../README.md#dépannage)), si les promos d'un magasin manquent ce matin,
  ou si elles n'ont pas pu être lues. La liste, elle, marche toujours.
- Les prix viennent des catalogues : ils peuvent varier en magasin (rupture, erreur de catalogue).

## Comment elle est faite

| Élément | Rôle |
|---|---|
| [`app/index.html`](../app/index.html) | Les écrans : connexion, liste, fenêtres. |
| [`app/src/main.js`](../app/src/main.js) | Le fonctionnement des écrans. |
| [`app/src/liste.js`](../app/src/liste.js) | Lecture et modification de la liste dans Firebase. |
| [`app/src/articles.js`](../app/src/articles.js) | Règles simples : nettoyage, doublons, tri, messages d'erreur. |
| [`app/src/membres.js`](../app/src/membres.js) | Qui a ajouté quoi : couleur et prénom de chacun, date d'ajout en clair. |
| [`app/src/tickets.js`](../app/src/tickets.js) | Les tickets de caisse : découpage du fichier, montant, date, classement par mois. |
| [`app/src/fichiers.js`](../app/src/fichiers.js) | Photo allégée avant l'envoi, affichage en grand, partage. |
| [`app/src/pdf.js`](../app/src/pdf.js) | Affichage des tickets en PDF ([PDF.js](https://mozilla.github.io/pdf.js/), chargé seulement à l'ouverture d'un PDF). |
| [`app/src/promos.js`](../app/src/promos.js) | Les promos : recherche pour chaque article et dans toutes les promos, dates, prix, fraîcheur des données. |
| [`app/src/familles.js`](../app/src/familles.js) | Les familles de produits : « chips » → Pringles, Lay's, Doritos… |
| [`app/src/installation.js`](../app/src/installation.js) | Quand proposer d'installer l'appli sur l'iPhone. |
| [`app/src/firebase.js`](../app/src/firebase.js) | Connexion au projet Firebase (et à l'émulateur pour les tests). |
| [`app/src/style.css`](../app/src/style.css) | L'apparence (iPhone, mode sombre). |
| [`app/vite.config.js`](../app/vite.config.js) | Construction de l'appli ([Vite](https://vite.dev)) et mode hors ligne / installable ([PWA](https://vite-pwa-org.netlify.app)). |
| [`app/outils/generer_icones.py`](../app/outils/generer_icones.py) | Dessine les icônes de l'appli. |

Aucune donnée n'est enregistrée ailleurs que dans Firebase et dans la mémoire du téléphone. Les
prénoms et les couleurs, en particulier, ne sont que dans Firebase, jamais dans ce dépôt public. Les
promos sont lues directement dans ce dépôt public : la liste de courses n'est jamais envoyée ailleurs
que dans Firebase.

## Les tests

| Tests | Ce qu'ils vérifient | Commande |
|---|---|---|
| Logique ([`app/tests`](../app/tests)) | Nettoyage des saisies, doublons, tri, messages d'erreur ; couleur et prénom de chacun, date d'ajout en clair ; tickets de caisse (découpage et recollage du fichier, montant, date, magasin deviné, classement par mois, taille des photos) ; recherche des promos (accents, pluriel, mots proches, marques, familles de produits, faux amis, début de mot, filtre par magasin), article créé depuis une promo, où va la réduction (caisse, lot, carte E.Leclerc, Lidl Plus), description sans les prix répétés, Leclerc d'abord, promos terminées ou à venir, dates, prix, fraîcheur des données ; quand proposer l'installation. | `npm test` |
| Scénarios réels ([`app/e2e`](../app/e2e)) | Un navigateur à la taille d'un iPhone utilise l'appli branchée sur l'**émulateur Firebase** (jamais la vraie base), avec deux comptes et un [fichier de promos d'exemple](../app/e2e/promos-exemple.js) aux dates du jour : connexion refusée, ajout, doublon, cochage, modification, suppression, synchronisation en direct entre deux téléphones, mode hors connexion, refus d'un compte étranger, déconnexion, étiquettes et détail des promos, promos anciennes ou incomplètes, promos indisponibles puis retrouvées, conseil d'installation dans Safari sur iPhone, glisser pour supprimer avec « Annuler », « Chips » qui trouve Pringles, promos affichées en écrivant (Leclerc d'abord, ajout d'une promo ou du texte écrit, affichage par 30), prix expliqué (carte E.Leclerc, Lidl Plus), prénom et couleur choisis sur un téléphone et vus sur l'autre (pastille, heure d'ajout), tickets de caisse en photo et en PDF ([fichiers d'exemple](../app/e2e/fichiers-exemple.js) : vus en grand sur l'autre téléphone, corrigés, partagés, supprimés, proposés après « Tout retirer », sans réseau, refusés à un compte étranger). Sur GitHub, ils tournent dans Chrome **et Safari** (WebKit). | `npm run e2e` |
| Captures d'écran | Régénère les images de cette page dans `docs/captures/`. | `npm run captures` |

Commandes à lancer dans le dossier `app/` (Node.js 22 et Java 21 nécessaires), après `npm ci`.

## La publication

À chaque modification de l'appli sur la branche `main`, le workflow
[« Appli »](../.github/workflows/appli.yml) lance tous les tests, construit l'appli et la publie sur
GitHub Pages. Si un test échoue, rien n'est publié : l'ancienne version reste en ligne.

La publication nécessite que GitHub Pages soit activé une fois pour toutes : dans le dépôt,
**Settings** → **Pages** → **Source** : « **GitHub Actions** ».
