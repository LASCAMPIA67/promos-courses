from robot_promos.outils import date_jj_mm, identifiant, nettoyer, nombre, prochain_jour


def test_nettoyer_enleve_balises_symboles_et_cesures():
    assert nettoyer("<p>SILVERCREST®  Machine&nbsp;à pâtes.</p>") == "SILVERCREST Machine à pâtes"
    assert nettoyer("Marsh- mallow") == "Marshmallow"
    assert nettoyer("PRIMA- DONNA") == "PRIMA-DONNA"
    assert nettoyer("") is None
    assert nettoyer(None) is None


def test_nettoyer_coupe_les_textes_trop_longs():
    texte = nettoyer("mot " * 200, longueur_max=30)
    assert len(texte) <= 30
    assert texte.endswith("…")


def test_nombre():
    assert nombre("2,57") == 2.57
    assert nombre("3.10") == 3.1
    assert nombre(4) == 4
    assert nombre("0.00") is None
    assert nombre("") is None
    assert nombre("abc") is None


def test_date_jj_mm_choisit_la_bonne_annee():
    assert date_jj_mm("Jeudi 22/10", "2026-10-22") == "2026-10-22"
    assert date_jj_mm("Lundi 04/01", "2026-12-30") == "2027-01-04"
    assert date_jj_mm("Mardi 29/12", "2027-01-02") == "2026-12-29"
    assert date_jj_mm("pas de date", "2026-10-22") is None


def test_prochain_jour():
    assert prochain_jour("2026-10-22", "dimanche") == "2026-10-25"  # un jeudi
    assert prochain_jour("2026-10-25", "dimanche") == "2026-10-25"
    assert prochain_jour("2026-10-22", "mercredi") == "2026-10-28"


def test_identifiant():
    assert identifiant("Pain de mie", 1.19) == "pain-de-mie-1-19"
    assert identifiant("Crème brûlée") == "creme-brulee"
