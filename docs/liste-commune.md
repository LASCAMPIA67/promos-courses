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
qui n'autorisent que les deux comptes du foyer.

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

### Collection `reglages` : réglages communs

Pour les préférences du foyer (cartes de fidélité, magasins préférés…). Son contenu sera défini avec
l'appli.

## Les règles d'accès

Elles se trouvent dans [`firebase/firestore.rules`](../firebase/firestore.rules) et garantissent que :

- seuls les deux comptes du foyer peuvent lire ou modifier quoi que ce soit ;
- un article a toujours la bonne forme (champs connus, longueurs raisonnables, dates du serveur) ;
- on ne peut pas ajouter un article au nom de l'autre, ni changer son auteur ou sa date d'ajout ;
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
une liste de courses en utilise une infime partie. En cas de dépassement, Firebase **coupe** le
service jusqu'au lendemain ou au mois suivant, mais ne facture jamais rien sur l'offre Spark.
