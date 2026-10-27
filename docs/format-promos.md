# Le fichier `promos.json`

`promos.json` est écrit chaque matin par le robot, à la racine du dépôt. C'est ce fichier que
l'appli lit, à l'adresse
[`raw.githubusercontent.com/LASCAMPIA67/promos-courses/main/promos.json`](https://raw.githubusercontent.com/LASCAMPIA67/promos-courses/main/promos.json).
Son format est décrit précisément (et vérifié à chaque passage) par le schéma
[`src/robot_promos/promos.schema.json`](../src/robot_promos/promos.schema.json).

> **Version du format : 2.** Le champ `format` change si la structure du fichier change d'une façon
> que l'appli doit connaître. Voir le [journal des versions](../CHANGELOG.md).
> L'appli refuse un fichier d'un autre format (elle affiche « Promos indisponibles ») : un changement
> de format doit donc être publié **en même temps** qu'une appli qui sait le lire.

## Vue d'ensemble

```json
{
  "format": 2,
  "mise_a_jour": "2026-10-27T05:48:12+01:00",
  "version_robot": "0.2.0",
  "magasins": { "lidl-lingolsheim": { "nom": "Lidl Lingolsheim", "enseigne": "Lidl", "ville": "Lingolsheim" } },
  "sources": [ { "id": "lidl", "etat": "ok", "nb_offres": 499, "catalogues": [ … ] } ],
  "offres": [ { "produit": "Banane", "prix": 0.95, … } ]
}
```

| Champ | Signification |
|---|---|
| `format` | Version du format du fichier (actuellement `2`). |
| `mise_a_jour` | Date et heure du passage du robot, heure de Paris. |
| `version_robot` | Version du robot qui a écrit le fichier. |
| `magasins` | Nos magasins, rangés par identifiant (`lidl-lingolsheim`, `leclerc-geispolsheim`). |
| `sources` | L'état de chaque source (voir ci-dessous). |
| `offres` | La liste des promos (voir ci-dessous). Les promos terminées sont retirées. |

## Une source

| Champ | Exemple | Signification |
|---|---|---|
| `id` | `leclerc` | Identifiant de la source. |
| `magasin` | `leclerc-geispolsheim` | Magasin concerné. |
| `nom` | `Catalogues E.Leclerc Geispolsheim` | Nom lisible. |
| `etat` | `ok` | `ok` : tout va bien. `partiel` : un catalogue n'a pas pu être lu (ses offres de la veille sont gardées). `erreur` : la source est injoignable (les offres de la veille encore valables sont gardées). |
| `nb_offres` | `1394` | Nombre d'offres de cette source dans le fichier. |
| `remarque` | `9 catalogue(s) ; 9 inchangé(s)…` | Explication en clair (et message d'erreur éventuel). |
| `catalogues` | | Les catalogues lus (voir ci-dessous). |

### Un catalogue

| Champ | Exemple | Signification |
|---|---|---|
| `id` | `26G124G` | Identifiant du catalogue chez l'enseigne. |
| `nom` | `Un automne en fête` | Nom du catalogue. |
| `debut`, `fin` | `2026-10-20`, `2026-10-31` | Période de validité. |
| `version` | | Change quand l'enseigne modifie le catalogue. |
| `lien` | | Adresse du catalogue sur le site de l'enseigne. |
| `nb_offres` | `384` | Nombre d'offres de ce catalogue dans le fichier. |
| `reutilise` | `true` | `true` si le catalogue n'avait pas changé : ses offres ont été reprises du passage précédent. |

## Une offre

| Champ | Exemple | Signification |
|---|---|---|
| `id` | `lidl-2026-10-22-80000` | Identifiant unique de l'offre. |
| `source` | `lidl` | Source de l'offre (`lidl` ou `leclerc`). |
| `magasin` | `lidl-lingolsheim` | Magasin. |
| `catalogue` | `du-22-10-au-28-10-les-promos-de-la-semaine` | Catalogue d'où vient l'offre. |
| `produit` | `Banane` | Nom du produit. |
| `marque` | `MILBONA` | Marque, si connue. |
| `description` | `Le kilo Catégorie 1` | Quantité, variétés, conditions… |
| `categorie` | `L'ÉPICERIE À PRIX E.LECLERC` | Rayon ou thème, si connu (Leclerc). |
| `ean` | `8000500242612` | Code-barres, si connu (Leclerc). |
| `prix` | `0.95` | **Prix d'UN article**, en euros. Si `carte_fidelite` vaut `true`, c'est le prix avec la carte. `null` pour une offre valable sur toute une marque. |
| `ancien_prix` | `1.45` | Prix habituel, quand le catalogue l'indique. |
| `prix_unitaire`, `unite` | `0.95`, `kg` | Prix au `kg`, au `l` ou à la `pièce` pour UN article. |
| `reduction` | `-34 % avec Lidl Plus` | La réduction, écrite en clair. |
| `lot` | `{"quantite": 2, "prix": 4.24, "prix_unitaire": 5.3}` | Quand l'avantage demande d'en acheter plusieurs (« 2e à -40 % », « 2 + 1 offert ») : quantité à acheter, prix total et prix au kilo du lot. |
| `carte_fidelite` | `true` | Il faut la carte (Lidl Plus, carte E.Leclerc / Ticket E.Leclerc). |
| `date_debut`, `date_fin` | `2026-10-22`, `2026-10-25` | Validité, dates incluses. Une promo dont `date_debut` est dans le futur est « à venir ». |
| `lien` | | Page du catalogue sur le site de l'enseigne. |
| `image` | | Photo du produit (Leclerc) ou de la page du prospectus (Lidl). |
| `page` | `3` | Numéro de page dans le prospectus (Lidl). |

## Comment l'appli s'en sert

Le code est dans [`app/src/promos.js`](../app/src/promos.js) ; le détail côté utilisateur est dans
[appli.md](appli.md#les-promos).

- **Trouver les promos d'un article** : chaque mot de l'article (« lait », « demi-écrémé ») doit se
  retrouver dans `produit` ou `marque`, sans tenir compte des majuscules, des accents ni du pluriel.
- **Promos terminées** (`date_fin` passée) : ignorées. **Promos à venir** (`date_debut` après
  aujourd'hui) : affichées avec « À partir du… ».
- **Comparer au kilo** : `prix_unitaire` (un article) et `lot.prix_unitaire` (si on achète le lot) sont
  affichés côte à côte. Un lot moins cher au kilo n'est intéressant que si on consomme vraiment la
  quantité.
- **Fraîcheur des données** : si `mise_a_jour` date de plus de 36 heures (le robot a manqué au moins un
  passage), un bandeau jaune prévient que les promos ont pu changer (voir le README, section
  « Dépannage »).
- **Sources en difficulté** : pour chaque source dont l'`etat` n'est pas `ok`, l'appli signale que les
  promos de ce magasin sont incomplètes (`partiel`) ou indisponibles (`erreur`).
