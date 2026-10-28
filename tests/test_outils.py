from robot_promos.outils import nettoyer, nombre


def test_nettoyer_enleve_balises_symboles_et_cesures():
    assert nettoyer("<p>NUTELLA®  Pâte&nbsp;à tartiner.</p>") == "NUTELLA Pâte à tartiner"
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
