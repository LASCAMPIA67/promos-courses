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
