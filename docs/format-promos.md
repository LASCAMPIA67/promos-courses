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
  "magasins": { "leclerc-geispolsheim": { "nom": "E.Leclerc Geispolsheim", "enseigne": "E.Leclerc", "ville": "Geispolsheim" } },
  "sources": [ { "id": "leclerc", "etat": "ok", "nb_offres": 1394, "catalogues": [ … ] } ],
  "offres": [ { "produit": "MOZZARELLA RÂPÉE", "prix": 1.11, … } ]
}
```

| Champ | Signification |
|---|---|
| `format` | Version du format du fichier (actuellement `2`). |
| `mise_a_jour` | Date et heure du passage du robot, heure de Paris. |
| `version_robot` | Version du robot qui a écrit le fichier. |
| `magasins` | Notre magasin, rangé par identifiant (`leclerc-geispolsheim`). |
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
| `id` | `leclerc-26g124e-33f09dcc3d51` | Identifiant unique de l'offre. |
| `source` | `leclerc` | Source de l'offre (`leclerc`). |
| `magasin` | `leclerc-geispolsheim` | Magasin. |
| `catalogue` | `26G124E` | Catalogue d'où vient l'offre. |
| `produit` | `MOZZARELLA RÂPÉE 22% MAT. GR` | Nom du produit. |
| `marque` | `LES CROISÉS` | Marque, si connue. |
| `description` | `Au lait de vache pasteurisé. 150 g.Le kg : 9,27 €` | Quantité, variétés, conditions… |
| `categorie` | `LE FRAIS À PRIX E.LECLERC` | Rayon ou thème, si connu. |
| `ean` | `3564706590298` | Code-barres, si connu. |
| `prix` | `1.11` | **Prix d'UN article**, en euros. Si `carte_fidelite` vaut `true`, c'est le prix avec la carte (une fois le Ticket E.Leclerc déduit). `null` pour une offre valable sur toute une marque. |
| `ancien_prix` | `1.39` | Prix habituel, quand le catalogue l'indique (pour un Ticket E.Leclerc : le prix payé en caisse). |
| `prix_unitaire`, `unite` | `7.4`, `kg` | Prix au `kg`, au `l` ou à la `pièce` pour UN article. |
| `reduction` | `20 % en Ticket E.Leclerc` | La réduction, écrite en clair. |
| `lot` | `{"quantite": 2, "prix": 7.46, "prix_unitaire": 10.66}` | Quand l'avantage demande d'en acheter plusieurs (« 2e à -68 % », « 2 + 1 offert ») : quantité à acheter, prix total et prix au kilo du lot. |
| `carte_fidelite` | `true` | Il faut la carte E.Leclerc (réduction en caisse ou Ticket E.Leclerc). |
| `date_debut`, `date_fin` | `2026-10-20`, `2026-10-31` | Validité, dates incluses. Une promo dont `date_debut` est dans le futur est « à venir ». |
| `lien` | | Page du catalogue sur le site de l'enseigne. |
| `image` | | Photo du produit (l'originale, dans le catalogue), **seulement si elle est sûre** : la photo du produit seul, qui porte son code-barres ou son nom exact. `null` sinon (produits frais, promos sur toute une marque). |
| `photo` | | Vignette de cette photo pour l'appli (256 pixels, JPEG), dans la branche `photos` du dépôt. `null` tant qu'elle n'est pas faite. Facultatif : un fichier sans ce champ reste valable. |
| `logo_catalogue` | | Logo de la marque joint par le catalogue à ce produit (l'original), **seulement si son nom est exactement la marque** ; `null` sinon. Facultatif. |
| `logo` | | Vignette du logo de la marque pour l'appli (PNG, 96 pixels de haut au plus), dans `logos/` de la branche `photos` : la même pour toutes les promos de la marque, même celles dont le produit n'a pas de logo dans le catalogue. Sinon le logo officiel pris sur Wikipédia (liste vérifiée à la main) ; le logo Marque Repère pour tous les produits Marque Repère. `null` sans logo sûr. Facultatif. |
| `logo_marque` | | La marque que montre le logo quand ce n'est pas celle du produit : `"Marque Repère"` (pour une gamme comme Délisse) ; `null` sinon. Facultatif. |
| `page` | `null` | Numéro de page dans le catalogue, si connu. |
| `historique` | `{"verdict": "plus_bas", "depuis": "2026-09-01", "promos": 3, "meilleur_prix": 1.99, "meilleur_le": "2026-10-01"}` | Ce que dit l'**historique des prix** de cette promo (voir ci-dessous) : `verdict` vaut `plus_bas` (jamais vue aussi basse), `egal` (le même prix que la meilleure) ou `plus_cher` (déjà vue moins chère), comparé aux `promos` d'avant du même produit, connues depuis `depuis` ; `meilleur_prix` et `meilleur_le` : la moins chère d'entre elles (prix pour un article, date de début). `null` faute de promo plus ancienne du même produit. Facultatif. |

## L'historique des prix (`historique.json`)

À chaque passage, le robot range à côté de `promos.json` les promos vues, produit par produit
(par code-barres), et les garde deux ans après leur fin. Avant de ranger les promos du jour, il
compare chacune aux promos d'avant du même produit : c'est le champ `historique` de l'offre. Le
prix comparé est le **prix le plus bas pour un article** : celui du lot quand il est moins cher
(« 2e à -40 % » : 3,70 € les 2, soit 1,85 € l'article), sinon `prix`. Code :
[`historique.py`](../src/robot_promos/historique.py).

```json
{
 "format": 1,
 "debut": "2026-10-28",
 "produits": {
  "3564700000017": {"produit": "PIZZA FRAÎCHE JAMBON FROMAGE", "marque": "TURINI", "promos": [{"catalogue": "26G310G", "du": "2026-10-27", "au": "2026-11-07", "prix": 1.85}]}
 }
}
```

- `debut` : le premier passage enregistré. L'historique a commencé **vide** le 28/10/2026 : les
  comparaisons arrivent au fil des semaines, quand un produit revient en promo.
- Une ligne par produit : le fichier reste lisible, et ses changements d'un jour à l'autre, petits.
- Une promo n'est rangée qu'une fois (même catalogue, même date de début), même avec plusieurs
  passages par jour ; si son prix change, on garde le plus bas.

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
- **Historique des prix** : sous le prix, une ligne dit si la promo est la moins chère vue depuis
  le début de l'historique de ce produit, aussi basse que la meilleure, ou déjà vue moins chère
  (champ `historique`).
- **Source en difficulté** : si l'`etat` n'est pas `ok`, l'appli signale que les promos du magasin
  sont incomplètes (`partiel`) ou pas à jour (`erreur`).
