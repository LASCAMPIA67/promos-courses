from robot_promos.web import est_autorise, lire_robots

ROBOTS_BONIAL = """
User-agent: AdsBot-Google
Disallow:

User-agent: *
crawl-delay: 2
Disallow: /Catalogue/
Disallow: /*/*/ajax/
Disallow: /api/frontend/
"""

ROBOTS_API = """
User-agent: *
Allow: /api/
Disallow: /

User-agent: GPTBot
Disallow: /
"""


def test_lit_les_regles_pour_tous_les_robots_et_le_delai():
    regles, delai = lire_robots(ROBOTS_BONIAL)
    assert delai == 2
    assert (False, "/Catalogue/") in regles
    assert all(motif for _, motif in regles)  # le « Disallow: » vide d'AdsBot est ignoré


def test_applique_les_jokers():
    regles, _ = lire_robots(ROBOTS_BONIAL)
    assert est_autorise(regles, "/Geispolsheim/Leclerc/p-r1")
    assert not est_autorise(regles, "/Catalogue/123")
    assert not est_autorise(regles, "/Geispolsheim/Leclerc/ajax/offres")


def test_la_regle_la_plus_precise_gagne():
    regles, _ = lire_robots(ROBOTS_API)
    assert est_autorise(regles, "/api/v1/offers")
    assert not est_autorise(regles, "/secret")


def test_dollar_marque_la_fin_du_chemin():
    regles = [(False, "/*.pdf$")]
    assert not est_autorise(regles, "/doc/prospectus.pdf")
    assert est_autorise(regles, "/doc/prospectus.pdf?page=2")


def test_sans_regles_tout_est_permis():
    assert est_autorise([], "/nimporte/quoi")
