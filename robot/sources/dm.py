"""dm-drogerie markt (Kehl-Goldscheuer), via Kaufda.

dm pratique des prix bas toute l'année : ses « Aktuelle Angebote » sont surtout des produits mis
en avant, rarement de vraies baisses de prix. Marktguru ne couvre pas dm, et l'API produits de
dm.de est interdite aux robots : Kaufda est la seule source autorisée trouvée.
"""

from sources import bonial

PAGE = "https://www.kaufda.de/Kehl/dm-drogerie-markt/p-r104"


def dm_kehl(nav):
    return bonial.lire_page(nav, PAGE, "dm_kaufda", "dm-kehl")
