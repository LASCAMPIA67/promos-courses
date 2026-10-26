# Sécurité

## Signaler un problème de sécurité

Si vous découvrez un problème de sécurité dans ce dépôt (par exemple une donnée personnelle ou une
clé publiée par erreur), merci de **ne pas ouvrir d'« issue » publique**. Utilisez plutôt le
signalement privé de GitHub : onglet **Security** → **Report a vulnerability**.

## Bonnes pratiques suivies

- Aucune donnée personnelle ni clé secrète dans le dépôt (il est public).
- Les éventuelles clés sont rangées dans les secrets GitHub, jamais dans le code.
- Les workflows n'ont que les permissions dont ils ont besoin.
- Les outils utilisés sont mis à jour chaque mois grâce à Dependabot.
