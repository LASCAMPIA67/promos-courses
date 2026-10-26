# L'appli

L'appli est une **application web** pensée pour l'iPhone : elle s'ouvre dans Safari et pourra
s'installer sur l'écran d'accueil comme une vraie appli (étape 5). Elle est publiée gratuitement par
GitHub Pages à l'adresse :

**https://lascampia67.github.io/promos-courses/**

Seuls nos deux comptes peuvent s'y connecter et voir la liste (voir
[liste-commune.md](liste-commune.md)).

| Connexion | Liste | Modifier un article | Mode sombre |
|---|---|---|---|
| ![Écran de connexion](captures/connexion.png) | ![Liste de courses](captures/liste.png) | ![Modifier un article](captures/modifier.png) | ![Liste en mode sombre](captures/liste-sombre.png) |

## Ce qu'elle sait faire (version 0.3)

- **Se connecter** avec son e-mail et son mot de passe (une seule fois : la connexion reste active).
  Lien « Mot de passe oublié ? » pour recevoir un e-mail de changement de mot de passe.
- **Ajouter un article** : écrire le nom (et, si on veut, la quantité), puis toucher **+** ou
  « OK » sur le clavier. Un article déjà dans la liste est signalé au lieu d'être ajouté en double
  (même écrit différemment : « Lait demi-écrémé » = « lait demi ecreme »).
- **Cocher** un article (le rond à gauche) : il passe dans « Dans le caddie ». Le décocher le remet
  dans la liste.
- **Modifier** un article (toucher son nom) : nom, quantité, note (« sans lactose »…), ou le supprimer.
- **Tout retirer** : vide d'un coup les articles du caddie, une fois les courses faites.
- **En direct sur les deux téléphones** : ce que l'un fait apparaît aussitôt chez l'autre.
- **Sans réseau** (au fond du magasin) : tout continue de marcher ; un bandeau jaune le signale et
  les changements partent dès que le réseau revient.
- **Mode sombre** automatique, textes lisibles par VoiceOver, grandes zones à toucher.

Les promos (comparaison de la liste avec les catalogues Lidl et Leclerc) arrivent à l'étape suivante.

## Comment elle est faite

| Élément | Rôle |
|---|---|
| [`app/index.html`](../app/index.html) | Les écrans : connexion, liste, fenêtres. |
| [`app/src/main.js`](../app/src/main.js) | Le fonctionnement des écrans. |
| [`app/src/liste.js`](../app/src/liste.js) | Lecture et modification de la liste dans Firebase. |
| [`app/src/articles.js`](../app/src/articles.js) | Règles simples : nettoyage, doublons, tri, messages d'erreur. |
| [`app/src/firebase.js`](../app/src/firebase.js) | Connexion au projet Firebase (et à l'émulateur pour les tests). |
| [`app/src/style.css`](../app/src/style.css) | L'apparence (iPhone, mode sombre). |
| [`app/vite.config.js`](../app/vite.config.js) | Construction de l'appli ([Vite](https://vite.dev)) et mode hors ligne / installable ([PWA](https://vite-pwa-org.netlify.app)). |
| [`app/outils/generer_icones.py`](../app/outils/generer_icones.py) | Dessine les icônes de l'appli. |

Aucune donnée n'est enregistrée ailleurs que dans Firebase et dans la mémoire du téléphone.

## Les tests

| Tests | Ce qu'ils vérifient | Commande |
|---|---|---|
| Logique ([`app/tests`](../app/tests)) | Nettoyage des saisies, doublons, tri, messages d'erreur. | `npm test` |
| Scénarios réels ([`app/e2e`](../app/e2e)) | Un navigateur à la taille d'un iPhone utilise l'appli branchée sur l'**émulateur Firebase** (jamais la vraie base), avec deux comptes : connexion refusée, ajout, doublon, cochage, modification, suppression, synchronisation en direct entre deux téléphones, mode hors connexion, refus d'un compte étranger, déconnexion. Sur GitHub, ils tournent dans Chrome **et Safari** (WebKit). | `npm run e2e` |
| Captures d'écran | Régénère les images de cette page dans `docs/captures/`. | `npm run captures` |

Commandes à lancer dans le dossier `app/` (Node.js 22 et Java 21 nécessaires), après `npm ci`.

## La publication

À chaque modification de l'appli sur la branche `main`, le workflow
[« Appli »](../.github/workflows/appli.yml) lance tous les tests, construit l'appli et la publie sur
GitHub Pages. Si un test échoue, rien n'est publié : l'ancienne version reste en ligne.

La publication nécessite que GitHub Pages soit activé une fois pour toutes : dans le dépôt,
**Settings** → **Pages** → **Source** : « **GitHub Actions** ».
