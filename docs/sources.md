# Les sources de promos

Ce document explique d'où viennent les promos, pourquoi cette source a été choisie, et ce qui a
été écarté. Dernière vérification : 28/10/2026.

## E.Leclerc Geispolsheim

**Source utilisée : les catalogues officiels du magasin (n° 1067).**

| Étape | Adresse | Règles du site (`robots.txt`) |
|---|---|---|
| 1. Liste des catalogues du magasin | `https://www.e.leclerc/mag/e-leclerc-geispolsheim` | autorisé |
| 2. Détails d'un catalogue | `https://nos-catalogues-promos-v2-api.e.leclerc/{code}/1067` | pas de `robots.txt` : autorisé |
| 3. Produits d'un catalogue | `https://nos-catalogues-promos-v2-api.e.leclerc/document/{id}/products` | pas de `robots.txt` : autorisé |

Ce service est celui qu'utilise la visionneuse officielle
[nos-catalogues-promos-v2.e.leclerc](https://nos-catalogues-promos-v2.e.leclerc). Il donne, pour
chaque produit : nom, marque, prix, prix barré, mécanique de promo, prix au kilo, code-barres,
dates, photo, disponibilité dans le magasin.

> **Décision du 26/10/2026.** Ce service n'accepte que les demandes qui disent venir de la
> visionneuse officielle (en-têtes `Origin` et `Referer`). C'est une zone grise : le robot ne lit
> que ce que n'importe qui voit dans son navigateur, sans compte ni captcha, et se présente sous son
> vrai nom, mais il indique venir de la visionneuse. Emilio a choisi de l'accepter. Le site principal
> `www.e.leclerc` interdit aux robots ses pages `/catalogue` : le robot ne les visite pas.

Pourquoi pas autre chose ?

- **Leclerc Drive** est protégé par un anti-robot (captcha) : on ne le contourne pas.
- **Tiendeo** interdit aux robots ses pages de catalogues.
- **Bonial** ne montre qu'une partie des offres.

## Photos des produits

Le catalogue donne, pour chaque produit, des photos « packshot » (le produit seul) et parfois des
photos d'« ambiance » (un plat, une mise en scène). Pour qu'une photo ne trompe jamais, le robot ne
garde que la photo **du produit seul** dont le nom de fichier porte le **code-barres** du produit
(presque toutes) ou exactement **son nom** ; sinon, pas de photo. Mesure du 28/10/2026 : 1 406
produits sur 1 538 ont une photo au code-barres, une quarantaine une photo à leur nom, et 83
produits frais n'ont qu'une photo d'ambiance (donc pas de photo dans l'appli).

Les photos du catalogue (`https://nos-catalogues-promos-v2.e.leclerc/media/…`, pas de `robots.txt` :
autorisé) pèsent 2 à 6 Mo. Le robot télécharge **une seule fois** chaque photo, avec la même pause
de 3 secondes entre deux demandes, et en fait une vignette JPEG de 256 pixels (une quinzaine de
Ko). Au plus une heure de photos par passage : les premiers jours, elles arrivent par vagues.

> **Décision du 28/10/2026.** Les vignettes sont rangées dans la branche `photos` de ce dépôt
> (public), réécrite à chaque passage : elle ne garde que les photos des promos en cours, sans
> historique. Ce sont des copies réduites des photos du catalogue Leclerc, que n'importe qui voit sur
> la visionneuse officielle : une zone grise pour le droit d'auteur, comme l'accès au catalogue.
> Emilio a choisi de l'accepter. Pour tout retirer d'un coup : supprimer la branche `photos`.

## L'avancée d'un passage

Pendant un passage, le robot écrit où il en est (« Catalogue 3 sur 9 : … », « Photos : 312 sur
1 450 ») dans un « statut » GitHub de l'enregistrement qu'il traite (nom : `robot-promos/avancee`,
voir [`avancee.py`](../src/robot_promos/avancee.py)), au plus toutes les 10 secondes. L'appli le lit
pour sa fenêtre « Mise à jour des promos » ([appli.md](appli.md#mettre-à-jour-les-promos-sans-attendre)).
Les étapes du passage (« Lire les catalogues », « Fabriquer les photos »…) sont celles du workflow
[`robot.yml`](../.github/workflows/robot.yml) : l'appli reprend leurs noms exacts, et un test vérifie
qu'ils restent identiques.

## Sources abandonnées

| Source | Magasin | Raison |
|---|---|---|
| Prospectus PDF officiel de Lidl France | Lidl Lingolsheim | Magasin retiré du projet : nous ne faisons nos courses que chez Leclerc (28/10/2026). |
| Marktguru | Lidl Kehl | Magasin retiré du projet (26/10/2026). |
| Kaufda | dm Kehl | Magasin retiré du projet (26/10/2026). |
| Bonial | Lidl Lingolsheim | Incomplet (16 offres sur ~280), remplacé par le PDF officiel (puis magasin retiré). |
| — | Auchan Illkirch | Magasin retiré du projet (26/10/2026). |

## Si une source change

Les sites changent parfois leur présentation. Dans ce cas :

1. le robot garde les offres de la veille encore valables ;
2. la source passe en `erreur` ou `partiel` dans `promos.json`, avec un message clair ;
3. un avertissement apparaît sur la page du lancement dans l'onglet **Actions** de GitHub.

Il faut alors adapter le module correspondant dans
[`src/robot_promos/sources/`](../src/robot_promos/sources/).
