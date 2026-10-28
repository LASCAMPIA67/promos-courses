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
> (public), réécrite à chaque passage, sans historique : elle garde les photos des promos en cours
> et celles des **produits déjà vus en promo** (tant qu'ils sont dans l'historique des prix, deux
> ans), pour les montrer aussi quand ils n'ont plus de promo ; `vignettes.json` dit laquelle va avec
> quel code-barres ([format](format-promos.md#les-vignettes-vignettesjson)). Ce sont des copies
> réduites des photos du catalogue Leclerc, que n'importe qui voit sur la visionneuse officielle :
> une zone grise pour le droit d'auteur, comme l'accès au catalogue. Emilio a choisi de l'accepter.
> Pour tout retirer d'un coup : supprimer la branche `photos`.

## Logos des marques

Le catalogue joint aussi des « logos » à beaucoup de produits : celui de la marque, mais parfois un
label (« POMMES_DE_FRANCE ») ou un visuel publicitaire. Le robot ne garde que le logo dont le nom de
fichier contient **exactement la marque**, en mots entiers qui se suivent (« LACTEL-LOGO », « PNG-LOGO
INNOCENT », « AIRWICK » pour AIR WICK), jamais un nom qui la contient seulement en partie
(« Clementoni » n'est pas la marque CLÉMENT, « DELPEYRAT » n'est pas toute la marque MAISON
DELPEYRAT). Seule exception : une courte liste de noms **regardés un par un à l'œil** (« PASQUIER »
pour BRIOCHE PASQUIER, « l'or » pour L'OR ESPRESSO, « PAT_PATROUILLE » pour PAW PATROL, et même
« 21G104G_3614706227189 », le logo Sodebo) : `AUTRES_NOMS_DE_LOGO` dans
[`leclerc.py`](../src/robot_promos/sources/leclerc.py). Une marque n'a qu'un logo, repris pour
toutes ses promos. Mesure du 28/10/2026 : 239
marques sur 547 ont un logo sûr, soit 59 % des produits de marque. Les autres gardent leur nom, écrit
en petit à la même place.

Le catalogue donne parfois un produit **sans marque** (« DORITOS », « MONSTER MUNCH », « KINDER
SCHOKOBONS »), mais avec son logo. Le robot lui donne alors la marque de ce logo, seulement si le nom
du produit commence exactement par le nom du logo, en mots entiers (un label comme
« POMMES_DE_FRANCE » ne devient jamais la marque des « POMMES GALA »). Voir `marque_du_logo` dans
[`leclerc.py`](../src/robot_promos/sources/leclerc.py).

Quelques **gammes** sont écrites comme une marque à part (« MONSTER MUNCH CRAZY », « PANIER DE
YOPLAIT », « DISNEY - STITCH ») : sans logo à elles, elles prennent celui de leur marque, d'après une
courte liste vérifiée à la main (`SOUS_MARQUES` dans [`marques.py`](../src/robot_promos/marques.py)).
Pas de règle automatique du genre « même début de nom, même marque » : LOTUS BABY (des couches)
n'est pas une gamme de LOTUS (des biscuits).

Le robot en fait une petite image PNG (96 pixels de haut au plus, 1 à 12 Ko), rangée dans `logos/` de
la branche `photos`, avec la même règle que les photos (téléchargée une seule fois, gardée tant
qu'un produit de la marque est dans l'historique des prix : l'appli la montre aussi pour ses
produits sans promo).

### Le logo Marque Repère

Les produits **Marque Repère** (la marque des centres E.Leclerc) ont tous le logo Marque Repère,
même quand le catalogue joint celui de leur gamme (Bio Village, Délisse…) : demande d'Emilio du
28/10/2026. Le robot les reconnaît à leur **code-barres** : ceux de Scamark, qui fabrique les
produits de la marque pour Leclerc, commencent par `356470`. Quelques gammes ont d'autres
codes-barres (la charcuterie Tradilège : `3661112…`) : elles sont reconnues à leur nom, tel qu'il
figure dans le [dossier de presse des 25 ans de Marque Repère](https://www.mouvement.leclerc/sites/default/files/2022-03/DP_25%20ans_Marque%20Repe%C4%9Are_vdef_1.pdf)
(2022) : Bio Village, Copains Copines, Délisse, Œufs de nos Régions, Pom'lisse, Récoltons l'Avenir,
Smicy, Soutenons nos Agriculteurs, Tradilège, Volandrie. Mots d'Enfants n'est Marque Repère que pour
ses couches et ses soins (au code-barres de Scamark), pas pour ses vêtements. Eco+ et Nos Régions
ont du Talent sont d'autres marques de Leclerc : elles gardent leur logo. Le détail est dans
[`marques.py`](../src/robot_promos/marques.py). Dans l'appli, VoiceOver lit « Marque Repère
(DÉLISSE) » : le nom de la gamme n'est pas perdu.

### Les logos pris sur Wikipédia

Pour les marques dont le catalogue ne donne pas de logo, le robot prend leur **logo officiel publié
sur Wikipédia**, d'après une liste **vérifiée à la main** :
[`logos.json`](../src/robot_promos/logos.json) (la marque, l'adresse de l'image, la page du fichier
avec sa source et sa licence). Le logo Marque Repère en fait partie. Le logo du catalogue passe
toujours en premier.

Pourquoi une liste, et pas une recherche automatique ? Parce que la recherche par nom se trompe trop
souvent : « SVR » donne une compagnie aérienne, « BERETTA » des armes (c'est ici de la charcuterie
italienne), « CATTIER » un champagne (ici des cosmétiques), « SCHNEIDER » une chaîne de pharmacies
(ici des gnocchis). Chaque logo de la liste a été regardé à l'œil, à côté des produits de la marque
dans les promos. À chaque passage, le résumé du robot sur GitHub liste les **marques encore sans
logo** : de quoi compléter la liste quand une nouvelle marque arrive.

Les images viennent de `upload.wikimedia.org` (son `robots.txt` l'autorise) : pour un dessin (SVG),
la miniature de taille standard de 500 pixels, comme le demandent les
[règles de Wikimedia](https://w.wiki/GHai) ; pour une image (PNG, JPEG), le fichier lui-même.
Chacune est téléchargée **une seule fois** par logo, avec la pause habituelle et l'adresse du projet
dans la présentation du robot (« User-Agent »). La liste vient des logos que Wikidata (la base de
Wikipédia) indique pour l'article Wikipédia de chaque marque, puis d'une vérification à l'œil :
les photos (une bouteille, une vitrine), les anciens logos, les logos d'une autre gamme
(« Paysan Breton, les surgelés » pour un fromage) et ceux d'une maison mère qui n'est pas la marque
du produit ont été écartés. Mesure du 28/10/2026 : 29 marques de plus ont un logo, et 37 promos ont
le logo Marque Repère ; en tout, 288 marques sur 540 et **70 % des produits de marque** ont un logo
(59 % avec le catalogue seul).

Les logos publiés **seulement dans les articles** de Wikipédia (comme celui de Sodebo ou de
Danone) se trouvent avec [DBpedia](https://www.dbpedia.org/), qui publie les données des articles
(le logo de l'encadré de chaque article). Comme Wikimedia limite les demandes depuis notre poste de
travail, c'est le robot qui télécharge ces logos, en deux temps :

1. **À vérifier** (`a_verifier` dans `logos.json`) : le robot télécharge le fichier (sur Wikimedia
   Commons, sinon sur le Wikipédia de l'article) dans `logos-a-verifier/` de la branche `photos`,
   **sans le montrer** dans l'appli ;
2. **vérifié** : après l'avoir regardé à l'œil, à côté des produits de la marque, on le passe dans
   `marques` ; un mauvais logo est simplement retiré de la liste.

> **Licences.** Les logos de Wikimedia Commons sont presque tous dans le domaine public (de simples
> textes, trop simples pour le droit d'auteur), mais restent des marques déposées ; ceux de
> Wikipédia en français ou en anglais (comme celui de Marque Repère) n'y sont publiés que pour
> illustrer l'article de la marque. Une petite copie dans l'appli, pour reconnaître la marque d'un
> produit en promo : la même zone grise que les logos du catalogue, acceptée par Emilio le
> 28/10/2026. La page de chaque fichier est notée dans `logos.json`.

## Tous les produits (Open Food Facts)

Pour trouver **tous les produits**, même sans promo (l'arôme Maggi, le Nutella, un shampooing…),
avec leur photo, l'appli lit `produits.json`, que le robot écrit **une fois par semaine** (le lundi
à 4 h 23, workflow [`produits.yml`](../.github/workflows/produits.yml), code
[`produits.py`](../src/robot_promos/produits.py)).

**D'où viennent les produits.** Les catalogues Leclerc ne donnent que les produits en promo. Le seul
endroit qui a tous les produits du magasin, avec leurs prix, est **Leclerc Drive** : il est protégé
par une vérification anti-robot (« Please enable JS and disable any ad blocker ») ; y aller quand
même, ce serait la contourner : écarté le 28/10/2026, comme l'application Leclerc. Le site
`e.leclerc` ne vend en ligne que du non-alimentaire (son plan du site ne liste pas les produits du
magasin : Kinder ou Doritos n'y sont pas). Les produits viennent donc de bases libres, faites par
leurs utilisateurs et tenues par la même association :

| Base | Ce qu'on y trouve | Fichier complet |
|---|---|---|
| [**Open Food Facts**](https://fr.openfoodfacts.org) | l'alimentaire | 1,5 Go |
| [Open Beauty Facts](https://fr.openbeautyfacts.org) | hygiène, beauté (shampooing, dentifrice…) | 18 Mo |
| [Open Products Facts](https://fr.openproductsfacts.org) | maison, entretien | 6 Mo |
| [Open Pet Food Facts](https://fr.openpetfoodfacts.org) | animaux (croquettes, pâtée…) | 3 Mo |

Leur fichier complet (dossier `/data/` de `static.…facts.org`, permis par leur `robots.txt`) est lu
**au fil du téléchargement, sans être gardé**, une fois par semaine. Le robot garde les produits
vendus en France (ou, sans pays indiqué, au code-barres français, `30` à `37`) qui ont un nom :

- ceux dont on est **sûr qu'ils sont chez Leclerc** : Marque Repère (code-barres `356470…`, plus de
  10 000), ceux que la base dit vendus chez Leclerc, et ceux déjà vus dans un catalogue Leclerc
  (l'[historique des prix](format-promos.md#lhistorique-des-prix-historiquejson)) ;
- les **produits courants**, avec une photo, d'un pays dont les produits se vendent en France (le
  début du code-barres) : scannés par au moins 3 personnes dans Open Food Facts ; tous ceux des
  bases sœurs, bien plus petites ;
- **sans** les marques propres des autres enseignes, qu'on ne trouve pas chez Leclerc : Carrefour,
  U, Auchan, Intermarché (Pâturages, Chabrior…), Lidl (Milbona…), Aldi, Monoprix, Casino… d'après
  leur nom et le début de leur code-barres (vérifié sur Open Food Facts : `3560070`, `3270190`
  Carrefour ; `325622` U ; `3596710` Auchan ; `325039` Intermarché et Netto ; `4056489` Lidl).

Si une base sœur est injoignable, les autres suffisent : c'est noté dans `produits.json`
(`sources`). Sans Open Food Facts, `produits.json` n'est pas modifié (celui de la semaine d'avant
reste).

Essai du 28/10/2026 sur les vrais fichiers : **111 895 produits** (Open Food Facts 95 041, Open
Beauty Facts 10 066, Open Products Facts 4 871, Open Pet Food Facts 2 598), dont 13 439 sûrs d'être
chez Leclerc et **109 072 avec une photo** (97 %) ; 10 Mo (3 Mo à télécharger), 10 minutes de
lecture pour le robot. Une recherche les parcourt en moins d'un dixième de seconde, un mot mal
écrit en moins de deux dixièmes (mesuré sur un ordinateur ; un peu plus sur un téléphone).

**Les photos.** Celle du **catalogue Leclerc** pour les produits déjà vus en promo (la même
vignette que la promo, gardée dans la branche `photos`, voir plus haut) ; sinon celle de la base du
produit (`images.openfoodfacts.org`, `images.openbeautyfacts.org`…), la photo de face choisie par
ses utilisateurs. Sans photo : l'emplacement neutre. Le **logo** de la marque : celui d'une promo en
cours, ou d'un produit de la marque déjà vu en promo ; sinon son nom en petit.

**Les prix.** Seuls ceux qu'un catalogue Leclerc a donnés : le **prix habituel** (l'ancien prix
barré, ou le prix d'un seul article pour une promo sur le lot), gardé dans l'historique des prix et
repris dans `produits.json`. Les autres produits n'affichent pas de prix.

**Rangement.** `produits.json` est dans la branche `produits` du dépôt, réécrite chaque semaine en un
seul enregistrement : le dépôt ne grossit pas. L'appli le garde sur le téléphone (la recherche
marche sans réseau, et ce qu'on tape ne sort pas du téléphone) ; les photos viennent directement
des sites des bases (ou de la branche `photos`) et restent aussi sur le téléphone, une fois vues.

> **Licences.** Les données de ces bases sont sous licence
> [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) (citer la source, partager à l'identique :
> `produits.json` l'est donc aussi), les photos sous licence
> [CC BY-SA](https://creativecommons.org/licenses/by-sa/3.0/deed.fr). L'appli le dit sous les
> produits trouvés (« Produits et photos : Open Food Facts et ses bases sœurs… »).

## L'avancée d'un passage

Pendant un passage, le robot écrit où il en est (« Catalogue 3 sur 9 : … », « Photos : 312 sur
1 450 ») dans un « statut » GitHub de l'enregistrement qu'il traite (nom : `robot-promos/avancee`,
voir [`avancee.py`](../src/robot_promos/avancee.py)), au plus toutes les 10 secondes. L'appli le lit
pour sa fenêtre « Mise à jour des promos » ([appli.md](appli.md#mettre-à-jour-les-promos-sans-attendre)).
Les étapes du passage (« Lire les catalogues », « Fabriquer les photos et les logos »…) sont celles du workflow
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
