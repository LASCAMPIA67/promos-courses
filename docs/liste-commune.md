# La liste de courses commune

La liste de courses est **commune aux deux iPhones** : ce que l'un ajoute, l'autre le voit aussitôt.
Elle n'est **pas** stockée dans ce dépôt (il est public) mais dans une base de données privée
**Firebase Cloud Firestore** (Google), sur l'offre gratuite **Spark**.

> **Décision du 26/10/2026** : Firebase a été préféré à Supabase (mis en pause après 7 jours sans
> utilisation), aux Rappels d'Apple (illisibles par une appli web) et à un fichier GitHub privé
> (pas de synchronisation instantanée).

## Le projet Firebase

| Élément | Valeur |
|---|---|
| Projet | `promos-courses` (offre gratuite Spark, sans carte bancaire) |
| Connexion | E-mail et mot de passe, deux comptes créés à la main dans la console |
| Base de données | Cloud Firestore, édition Standard, emplacement « Europe » (multirégion), mode « production » : tout est fermé sauf ce que les règles autorisent |
| Règles d'accès | [`firebase/firestore.rules`](../firebase/firestore.rules) |

Les informations de connexion de l'appli au projet (`firebaseConfig`, dont la clé `apiKey`) **ne sont
pas secrètes** : toute appli web Firebase les montre. La sécurité repose sur les **règles d'accès**,
qui n'autorisent que les deux comptes du foyer, et, en plus, sur la limite de la clé ci-dessous.

### La clé de l'appli, limitée à son adresse

Depuis le 27/10/2026, la clé (« Browser key (auto created by Firebase) ») ne marche **que depuis
l'adresse de l'appli** : une autre page web qui la recopierait est refusée par Google.

| Réglage | Valeur |
|---|---|
| Où | [Console Google Cloud → Identifiants](https://console.cloud.google.com/apis/credentials?project=promos-courses) → la clé → « Restrictions relatives aux applications » |
| Type | « Sites Web » |
| Sites autorisés | `https://lascampia67.github.io/*` (l'appli) et `https://promos-courses.firebaseapp.com/*` (la page « Mot de passe oublié » de Firebase) |
| Restrictions relatives aux API | Inchangées (seulement les services Firebase, réglage d'origine) |

Vérifié le 27/10/2026 : une demande de connexion venant d'un autre site, ou sans adresse d'origine,
reçoit « 403 Requests from referer … are blocked » ; celles de l'appli passent normalement.

Si l'adresse de l'appli change un jour, il faut l'ajouter ici, sinon plus personne ne pourra se
connecter. Pour faire tourner l'appli sur un ordinateur avec la vraie base (`npm run dev`), il faut
ajouter temporairement `http://localhost:5173/*` (ou utiliser l'émulateur, voir
[CONTRIBUTING.md](../CONTRIBUTING.md)).

## Les données

### Collection `articles` : la liste de courses

Un document par article, pour que deux modifications en même temps ne se gênent jamais.

| Champ | Type | Obligatoire | Signification |
|---|---|---|---|
| `nom` | texte (1 à 100 caractères) | oui | Ce qu'il faut acheter : « lait », « beurre doux »… |
| `quantite` | texte (30 caractères max.) | non | « 2 L », « 1 kg », « 6 »… |
| `note` | texte (200 caractères max.) | non | Précision libre : « sans lactose », « marque Milbona »… |
| `achete` | vrai / faux | oui | Coché quand c'est dans le caddie. |
| `ajoute_par` | identifiant de compte | oui | Qui a ajouté l'article (ne peut plus changer ensuite). |
| `cree_le` | date du serveur | oui | Date d'ajout (ne peut plus changer ensuite). |
| `modifie_le` | date du serveur | oui | Date de la dernière modification. |

### Collection `membres` : qui est qui

Un document par compte, dont l'identifiant est celui du compte. Il sert aux **pastilles de couleur**
de la liste (qui a ajouté quoi). Les prénoms ne sont **que dans Firebase**, jamais dans ce dépôt.

| Champ | Type | Obligatoire | Signification |
|---|---|---|---|
| `prenom` | texte (1 à 30 caractères) | oui | Le prénom affiché : « Ajouté par … ». |
| `couleur` | `vert`, `violet`, `bleu`, `orange`, `rose` ou `jaune` | oui | La couleur de ses articles. |

Chacun ne peut écrire que **sa propre** fiche ; les deux comptes peuvent lire les deux fiches. Sans
fiche, un compte a une couleur donnée d'office et s'appelle « vous » ou « l'autre compte ».

### Collection `tickets` : les tickets de caisse

Un document par ticket, avec ce qu'on a indiqué en l'ajoutant. Le fichier (photo allégée ou PDF)
est à part, dans la sous-collection `tickets/{id}/morceaux`, découpé en morceaux de 900 000 octets
au plus : un document Firestore ne peut pas dépasser 1 Mio.

| Champ | Type | Obligatoire | Signification |
|---|---|---|---|
| `magasin` | `leclerc`, `lidl` ou `autre` | oui | Où ont été faites les courses. |
| `date_achat` | texte `AAAA-MM-JJ` | oui | Le jour des courses. |
| `montant` | nombre (0 à 10 000) | non | Le total du ticket, en euros. |
| `note` | texte (200 caractères max.) | non | « garantie de la cafetière »… |
| `type` | `image/jpeg` ou `application/pdf` | oui | Photo allégée, ou PDF gardé tel quel. |
| `taille` | nombre entier (5 Mio max.) | oui | Taille du fichier, en octets. |
| `morceaux` | nombre entier (1 à 6) | oui | En combien de morceaux le fichier est découpé. |
| `ajoute_par` | identifiant de compte | oui | Qui a ajouté le ticket (ne peut plus changer). |
| `cree_le` | date du serveur | oui | Date d'ajout (ne peut plus changer). |

Chaque morceau (`tickets/{id}/morceaux/0`, `…/1`…) n'a qu'un champ, `donnees` (octets). La fiche et
ses morceaux sont envoyés ensemble, en une fois : un ticket n'est jamais à moitié enregistré.

**Pourquoi pas Firebase Storage**, prévu pour les fichiers ? Depuis février 2026, il demande l'offre
payante Blaze (avec une carte bancaire). Le 27/10/2026, nous avons choisi de garder l'offre gratuite :
une photo allégée pèse 200 à 400 Ko, et le 1 Go gratuit de Firestore suffit pour environ 3 000
tickets.

### Collection `reglages` : réglages communs

Pour les préférences du foyer (cartes de fidélité, magasins préférés…). Son contenu sera défini avec
l'appli.

## Les règles d'accès

Elles se trouvent dans [`firebase/firestore.rules`](../firebase/firestore.rules) et garantissent que :

- seuls les deux comptes du foyer peuvent lire ou modifier quoi que ce soit ;
- un article a toujours la bonne forme (champs connus, longueurs raisonnables, dates du serveur) ;
- on ne peut pas ajouter un article au nom de l'autre, ni changer son auteur ou sa date d'ajout ;
- chacun ne modifie que sa propre fiche `membres` (prénom et couleur), toujours de la bonne forme ;
- un ticket de caisse a toujours la bonne forme ; son fichier ne change jamais une fois envoyé (seuls
  le magasin, la date, le montant et la note peuvent être corrigés), et chaque morceau appartient à
  un ticket existant, sans dépasser le nombre de morceaux prévu ni 900 000 octets ;
- toute autre collection est fermée.

### Les mettre en place ou les modifier

Les règles ne s'appliquent qu'une fois **publiées dans la console Firebase** :

1. Ouvrir [console.firebase.google.com](https://console.firebase.google.com) → projet `promos-courses`.
2. Menu **☰** → **Databases & Storage** → **Firestore** → onglet **Règles**.
3. Remplacer tout le texte par le contenu de `firebase/firestore.rules`.
4. Cliquer sur **Publier**.

### Ajouter un compte (par exemple un nouveau téléphone avec un autre compte)

1. Console Firebase → **Security** → **Authentication** → **Users** → **Ajouter un utilisateur**.
2. Copier son **UID** et l'ajouter à la liste de la fonction `estDuFoyer` dans `firebase/firestore.rules`.
3. Lancer les tests (ci-dessous), enregistrer, puis republier les règles dans la console.

## Les tests des règles

Les règles sont testées automatiquement sur l'**émulateur Firebase** (une copie locale de Firestore :
la vraie base n'est jamais touchée), à chaque modification, par le workflow « Règles Firebase ».

Pour les lancer sur un ordinateur (Node.js 22 et Java 21 nécessaires) :

```bash
cd firebase
npm ci
npm test
```

## Limites de l'offre gratuite

L'offre Spark permet chaque jour environ 50 000 lectures et 20 000 écritures, et 1 Go de données :
une liste de courses en utilise une infime partie. Les tickets de caisse prennent plus de place :
environ 300 Ko par ticket, soit environ 3 000 tickets pour 1 Go. Ouvrir un ticket compte une lecture
par morceau (une ou deux en général). En cas de dépassement, Firebase **coupe** le
service jusqu'au lendemain ou au mois suivant, mais ne facture jamais rien sur l'offre Spark.
