# Promos courses

Appli perso pour nos deux iPhones : on y met notre liste de courses, et elle trouve toute seule
quels articles sont en promo en ce moment, dans quel magasin et à quel prix.

## Où en est le projet

1. Choisir les magasins ✅
2. Tester les sources ✅
3. Créer le robot — **en cours**
   - 3.1 Créer le dépôt ✅
   - 3.2 Robot pour Lidl France, Lidl Allemagne et dm ✅ (en attente de validation)
   - 3.3 Ajouter Leclerc et Auchan — à faire
4. Créer l'appli (web, hébergée gratuitement sur GitHub Pages) — à faire
5. L'installer sur nos iPhones — à faire

Dernière mise à jour de ce fichier : 26/10/2026.

## Nos magasins

| Magasin | Pays |
|---|---|
| Lidl Lingolsheim | France |
| E.Leclerc Geispolsheim | France (pas encore dans le robot) |
| Auchan Illkirch-Graffenstaden | France (pas encore dans le robot) |
| Lidl Kehl-Goldscheuer | Allemagne |
| dm Kehl-Goldscheuer | Allemagne |

## Comment ça marche

Un **robot** (programme Python, dossier `robot/`) tourne tout seul chez GitHub, **chaque jour vers
5 h 45, heure de Paris**. Il va lire les promos sur quelques sites, puis les écrit dans le fichier
**`promos.json`** de ce dépôt. L'appli lira ce fichier.

Rien à faire au quotidien.

### Lancer le robot à la main (pour tester)

1. Sur GitHub, ouvrir l'onglet **Actions** du dépôt.
2. À gauche, cliquer sur **Robot des promos**.
3. À droite, cliquer sur **Run workflow**, puis sur le bouton vert **Run workflow**.
4. Au bout d'une minute environ, cliquer sur le lancement : un tableau résume ce qui a été trouvé.

### Si le robot s'arrête tout seul

GitHub met en pause les tâches automatiques d'un dépôt public quand il ne s'y passe rien pendant
**60 jours**. Le robot enregistre chaque jour un nouveau `promos.json`, ce qui devrait compter
comme de l'activité, mais GitHub ne le garantit pas noir sur blanc. Si `promos.json` n'est plus mis
à jour (l'appli le signalera) :
onglet **Actions** → **Robot des promos** → bouton **Enable workflow**.

## Les sources

| Source | Magasin | Ce qu'elle donne | Limites |
|---|---|---|---|
| Marktguru (marktguru.de) | Lidl Kehl | Toutes les promos du prospectus (≈ 800) : prix, prix au kilo/litre, dates, Lidl Plus | Pas d'ancien prix |
| Bonial (bonial.fr) | Lidl Lingolsheim | Promos alimentaires avec ancien prix et Lidl Plus | Seulement 16 offres visibles sur ≈ 280 |
| Prospectus Lidl (service officiel utilisé par lidl.fr) | Lidl Lingolsheim | Produits non alimentaires (cuisine, outils, vêtements…), semaine en cours et suivante | Pas d'alimentaire, pas d'ancien prix |
| Kaufda (kaufda.de) | dm Kehl | Produits mis en avant par dm | Seulement 16 offres visibles sur ≈ 130 ; rarement de vraies baisses de prix (dm a des prix fixes toute l'année) |

Sources écartées : l'API produits de dm.de (interdite aux robots), les pages /Catalogues/ de Tiendeo
(interdites aux robots), les pages produits de lidl.fr (les prix n'y sont pas).

**Piste pour mieux couvrir Lidl France :** le prospectus PDF de Lidl France contient du texte
lisible (produits, prix, anciens prix). On pourrait en extraire les promos alimentaires
gratuitement, sans IA payante. À décider.

## Règles que le robot respecte

- Il lit le fichier `robots.txt` de chaque site et ne visite jamais une page interdite.
- Un seul passage par jour, avec au moins 3 secondes de pause entre deux visites.
- Si une source tombe en panne, il continue avec les autres, le note dans `promos.json`, et garde
  les offres de la veille encore valables pour cette source.
- Aucune donnée personnelle ni clé secrète dans ce dépôt (il est public).

## Le fichier promos.json

- `mise_a_jour` : date et heure du dernier passage du robot.
- `magasins` : la liste de nos magasins.
- `sources` : pour chaque source, `etat` (`ok` ou `erreur`), `nb_offres` et une `remarque`.
- `offres` : la liste des promos. Pour chacune :

| Champ | Exemple | Signification |
|---|---|---|
| `magasin` | `lidl-kehl` | Le magasin (voir `magasins`) |
| `pays`, `langue` | `DE`, `de` | Pays du magasin et langue du nom du produit |
| `produit`, `marque` | `Frische Vollmilch`, `Milbona` | |
| `description` | `Je 1 l` | Quantité, conditions… |
| `categorie` | `Milch` | Rayon, quand la source le donne |
| `prix` | `1.11` | Prix en euros |
| `ancien_prix` | `1.45` | Prix barré, si connu |
| `prix_unitaire`, `unite` | `1.11`, `l` | Prix au `kg`, au `l` ou à la `pièce` |
| `reduction` | `-34% avec Lidl Plus` | Texte de la réduction, ou calculée |
| `date_debut`, `date_fin` | `2026-10-26`, `2026-10-31` | Validité de la promo (incluses) |
| `carte_fidelite` | `true` | Il faut la carte (ex. Lidl Plus) |
| `lien`, `image` | | Page source et photo |

## Pour les curieux : lancer le robot sur un ordinateur

```
pip install -r requirements.txt
python robot/robot.py
```
