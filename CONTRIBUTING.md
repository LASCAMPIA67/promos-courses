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

Il faut Python 3.12 ou plus récent.

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
ruff check src tests        # règles de style
ruff format src tests       # mise en forme automatique
pytest                      # tests automatiques (sans internet)
```

Les mêmes vérifications tournent sur GitHub (workflow « Tests ») à chaque modification du code.

Les règles d'accès de la liste commune ([`firebase/firestore.rules`](firebase/firestore.rules)) ont
leurs propres tests, sur l'émulateur Firebase (Node.js 22 et Java 21 nécessaires) :

```bash
cd firebase
npm ci
npm test
```

Une modification des règles doit ensuite être **publiée à la main** dans la console Firebase (voir
[docs/liste-commune.md](docs/liste-commune.md#les-mettre-en-place-ou-les-modifier)).

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

Les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/).

1. Décrire les changements dans [CHANGELOG.md](CHANGELOG.md), sous un nouveau titre
   `## [X.Y.Z] - AAAA-MM-JJ`, et mettre à jour les liens en bas du fichier.
2. Mettre le même numéro dans `src/robot_promos/__init__.py`.
3. Enregistrer (commit) et envoyer sur la branche `main`.
4. Le workflow « Publication » voit que le numéro a changé : il crée l'étiquette `vX.Y.Z` et la page
   de la version sur GitHub, avec les notes du CHANGELOG.

On peut aussi publier en poussant soi-même une étiquette (`git tag -a vX.Y.Z` puis
`git push origin vX.Y.Z`), ou à la main : onglet **Actions** → **Publication** → **Run workflow**.

## Signaler un problème ou proposer une idée

Utiliser l'onglet **Issues** du dépôt : des formulaires guident la saisie.
