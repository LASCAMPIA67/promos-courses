# Les sources de promos

Ce document explique d'où viennent les promos, pourquoi ces sources ont été choisies, et ce qui a
été écarté. Dernière vérification : 26/10/2026.

## Lidl Lingolsheim

**Source utilisée : le prospectus PDF officiel de Lidl France.**

| Étape | Adresse | Règles du site (`robots.txt`) |
|---|---|---|
| 1. Liste des prospectus | `https://www.lidl.fr/c/catalogues-en-ligne/s10017753` | autorisé |
| 2. Détails de chaque prospectus (dates, PDF, images des pages) | `https://endpoints.leaflets.schwarz/v4/flyer` | pas de `robots.txt` : autorisé |
| 3. Téléchargement du PDF | `https://assets.leaflets.schwarz/…pdf` | pas de `robots.txt` : autorisé |

Le robot lit les prospectus « Les promos de la semaine » de la semaine en cours **et** de la
suivante (promos à venir). Il ignore les prospectus « Exclus Web » et les produits marqués
« Uniquement en ligne », vendus seulement sur internet.

Le PDF contient du vrai texte (pas seulement des images) : le robot le lit **gratuitement**, sans
intelligence artificielle. Il repère le nom, la description, le prix, l'ancien prix, la réduction,
le logo Lidl Plus et les dates de chaque page (« Jeudi 22/10 », « Du jeudi au dimanche »). Le PDF
fait environ 55 Mo : il n'est téléchargé qu'une fois par version.

Pourquoi pas autre chose ?

- **lidl.fr** n'affiche aucun prix alimentaire (seulement « en supermarché ») : inutilisable.
- **Bonial** ne montre que 16 promos sur environ 280.
- Le service des prospectus ne détaille, en France, que les produits non alimentaires.

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
| Marktguru | Lidl Kehl | Magasin retiré du projet (26/10/2026). |
| Kaufda | dm Kehl | Magasin retiré du projet (26/10/2026). |
| Bonial | Lidl Lingolsheim | Incomplet (16 offres sur ~280), remplacé par le PDF officiel. |
| — | Auchan Illkirch | Magasin retiré du projet (26/10/2026). |

## Si une source change

Les sites changent parfois leur présentation. Dans ce cas :

1. le robot continue avec les autres sources et garde les offres de la veille encore valables ;
2. la source passe en `erreur` ou `partiel` dans `promos.json`, avec un message clair ;
3. un avertissement apparaît sur la page du lancement dans l'onglet **Actions** de GitHub.

Il faut alors adapter le module correspondant dans
[`src/robot_promos/sources/`](../src/robot_promos/sources/).
