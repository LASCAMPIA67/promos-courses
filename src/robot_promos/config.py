"""Réglages du robot : nos magasins et les règles de politesse envers les sites."""

from zoneinfo import ZoneInfo

FUSEAU = ZoneInfo("Europe/Paris")

# On se présente honnêtement aux sites visités.
USER_AGENT = "Mozilla/5.0 (compatible; promos-courses/1.0; +https://github.com/lascampia67/promos-courses)"

# Pause minimale entre deux requêtes, en secondes (plus si le site le demande dans robots.txt).
PAUSE = 3

# Nos magasins. On ne garde que l'enseigne et la ville : pas besoin de plus.
MAGASINS = {
    "lidl-lingolsheim": {"nom": "Lidl Lingolsheim", "enseigne": "Lidl", "ville": "Lingolsheim"},
    "leclerc-geispolsheim": {"nom": "E.Leclerc Geispolsheim", "enseigne": "E.Leclerc", "ville": "Geispolsheim"},
}

# Numéro du magasin E.Leclerc de Geispolsheim dans les catalogues Leclerc.
LECLERC_NUMERO_MAGASIN = "1067"
