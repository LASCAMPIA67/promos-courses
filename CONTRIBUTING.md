# Contribuer au projet

Merci de votre intérêt ! Ce projet est personnel (un couple et ses courses), mais il est public :
ce guide explique comment il est organisé et comment y travailler proprement.

## Règles du projet

- **Respect des sites** : lire et respecter `robots.txt`, au moins 3 secondes entre deux requêtes,
  un seul passage par jour, ne rien contourner (captcha, connexion…). Les exceptions décidées par
  le propriétaire sont notées dans [docs/sources.md](docs/sources.md).
- **Aucune donnée personnelle ni clé secrète** dans le dépôt : il est public. Les clés éventuelles
  vont dans les *secrets* GitHub (Settings → Secrets and variables → Actions).
- **Rien de payant ou d'irréversible** sans l'accord du propriétaire.
- Tout est écrit **en français**, simplement.

## Installer le projet sur un ordinateur

Il faut Python 3.12 ou plus récent, et pour l'appli et les règles Firebase, Node.js 22 (la version
est notée dans [`.nvmrc`](.nvmrc) : `nvm use` la choisit toute seule) et Java 21.

```bash
git clone https://github.com/lascampia67/promos-courses.git
cd promos-courses
python -m venv .venv
source .venv/bin/activate        # sous Windows : .venv\Scripts\activate
pip install -e ".[dev]"
```

## Lancer le robot

```bash
python -m robot_promos                 # écrit promos.json
python -m robot_promos --sans-cache    # relit tous les catalogues, même inchangés
python -m robot_promos --help
```

## Vérifier son travail

```bash
ruff check src tests        # règles de style, pièges courants et sécurité
ruff format src tests       # mise en forme automatique
pytest                      # tests automatiques (sans internet)
```

Les mêmes vérifications tournent sur GitHub (workflow « Tests ») à chaque modification du code.
Les règles de Ruff choisies sont listées dans [`pyproject.toml`](pyproject.toml).

Les règles d'accès de la liste commune ([`firebase/firestore.rules`](firebase/firestore.rules)) ont
leurs propres tests, sur l'émulateur Firebase (Node.js 22 et Java 21 nécessaires) :

```bash
cd firebase
npm ci
npm test
npm run lint && npm run format:check   # style du code des tests
```

Une modification des règles doit ensuite être **publiée à la main** dans la console Firebase (voir
[docs/liste-commune.md](docs/liste-commune.md#les-mettre-en-place-ou-les-modifier)).

L'appli ([`app/`](app/)) a ses tests de logique et ses scénarios réels sur l'émulateur Firebase :

```bash
cd app
npm ci
npm test            # logique (Vitest)
npm run e2e         # scénarios réels, deux comptes, émulateur Firebase (Playwright)
npm run captures    # régénère les captures d'écran de docs/captures/
npm run lint        # pièges courants (ESLint), dont un « await » oublié dans les scénarios
npm run format      # mise en forme automatique (Prettier) ; format:check ne fait que vérifier
```

Attention : `npm run dev` lance l'appli sur l'ordinateur branchée sur la **vraie** base Firebase. La
clé de l'appli ne marchant que depuis son adresse publique, il faut d'abord autoriser
`http://localhost:5173/*` (voir [docs/liste-commune.md](docs/liste-commune.md#la-clé-de-lappli-limitée-à-son-adresse)) ;
les tests, eux, utilisent l'émulateur et n'en ont pas besoin.
Une fois sur `main`, le workflow « Appli » teste l'appli puis la publie sur GitHub Pages.

## Qualité et sécurité du code

| Outil | Ce qu'il vérifie | Où |
|---|---|---|
| [Ruff](https://docs.astral.sh/ruff/) | Style, pièges courants, sécurité (règles « bandit ») et mise en forme du robot. | `pyproject.toml`, workflow « Tests » |
| [ESLint](https://eslint.org/docs/latest/) | Pièges courants du JavaScript ; pour les scénarios, les règles officielles de Playwright. | `app/eslint.config.js`, `firebase/eslint.config.js` |
| [Prettier](https://prettier.io/docs/) | Mise en forme du JavaScript, du HTML et du CSS (lignes de 120 caractères, comme Ruff). | `.prettierrc.json` |
| [EditorConfig](https://editorconfig.org) | Encodage, fins de ligne, indentation, pour tous les éditeurs. | `.editorconfig` |
| [CodeQL](https://docs.github.com/fr/code-security/code-scanning) | Failles de sécurité du Python, du JavaScript et des workflows, chaque semaine et à chaque modification. | workflow « CodeQL », onglet **Security** |
| [Dependabot](https://docs.github.com/fr/code-security/dependabot) | Mises à jour des outils et des actions GitHub, une fois par mois. | `.github/dependabot.yml` |

Les workflows suivent les [recommandations de sécurité de GitHub](https://docs.github.com/fr/actions/reference/security/secure-use) :

- chaque action est **fixée sur un commit précis** (`actions/checkout@3d3c42e… # v7.0.1`) et non
  sur une étiquette qui pourrait être déplacée ; Dependabot met à jour le commit et le commentaire ;
- le jeton de chaque workflow n'a que les **droits nécessaires** (lecture seule par défaut,
  écriture seulement pour le travail qui en a besoin) ;
- le jeton git n'est **pas gardé** après la récupération du dépôt, sauf pour le robot qui enregistre
  `promos.json` ;
- les valeurs saisies à la main (« Run workflow ») passent par des variables d'environnement, jamais
  directement dans les commandes.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `src/robot_promos/robot.py` | Chef d'orchestre : interroge les sources, écrit `promos.json`. |
| `src/robot_promos/web.py` | Téléchargement poli (`robots.txt`, pauses, nouvelles tentatives). |
| `src/robot_promos/offres.py` | Format d'une offre, doublons, vérification du schéma. |
| `src/robot_promos/promos.schema.json` | Schéma JSON de `promos.json`. |
| `src/robot_promos/sources/lidl.py` | Source Lidl : prospectus de la semaine. |
| `src/robot_promos/sources/lidl_pdf.py` | Lecture du PDF Lidl. |
| `src/robot_promos/sources/leclerc.py` | Source Leclerc : catalogues du magasin. |
| `src/robot_promos/config.py` | Magasins et réglages. |

Pour ajouter une source : créer un module dans `sources/` avec une classe qui hérite de `Source`
(méthodes `catalogues` et `offres`), l'ajouter à `SOURCES` dans `robot.py`, au schéma JSON et aux
tests.

## Publier une nouvelle version

Les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/). Chaque version passe
par deux temps, gérés par le workflow « Publication » :

**1. En test.** Mettre le numéro de la version suivante dans `app/package.json` (il s'affiche en bas
de l'appli) et décrire chaque changement dans [CHANGELOG.md](CHANGELOG.md), sous `## [Non publié]`.
À chaque envoi sur `main`, la version est publiée (ou remise à jour) comme **pré-version**
(« Pre-release ») `vX.Y.Z`, intitulée « Version X.Y.Z (en test) », avec les notes de `[Non publié]`.

**2. Validée.** Une fois la version validée sur nos iPhones :

1. dans [CHANGELOG.md](CHANGELOG.md), renommer `## [Non publié]` en `## [X.Y.Z] - AAAA-MM-JJ`,
   remettre un `## [Non publié]` vide au-dessus, et mettre à jour les liens en bas du fichier ;
2. mettre le même numéro dans `src/robot_promos/__init__.py` ;
3. enregistrer (commit) et envoyer sur `main`.

« Publication » voit que le numéro validé a changé : il remplace la pré-version par la version
définitive `vX.Y.Z` (« Latest »), avec les notes de sa section du CHANGELOG.

On peut aussi publier une version validée en poussant soi-même une étiquette (`git tag -a vX.Y.Z`
puis `git push origin vX.Y.Z`), ou à la main : onglet **Actions** → **Publication** → **Run
workflow**. Lancé à la main pour une version déjà publiée, il remet à jour ses notes à partir du
CHANGELOG.

Dans les notes de version, les liens relatifs (`docs/appli.md`…) sont transformés en liens vers les
fichiers de cette version, pour qu'ils marchent sur la page de la version.

## Signaler un problème ou proposer une idée

Utiliser l'onglet **Issues** du dépôt : des formulaires guident la saisie.
