"""Tests des marques : les produits Marque Repère, et la liste des logos pris sur Wikipédia."""

import json
from importlib import resources

from robot_promos.marques import MARQUE_REPERE, cle_marque, est_marque_repere, logos_officiels


def test_cle_marque():
    assert cle_marque("Mots d’Enfants") == cle_marque("MOTS D'ENFANTS") == "MOTS D'ENFANTS"
    assert cle_marque("  bio   Village ") == "BIO VILLAGE"
    assert cle_marque(None) == ""


def test_est_marque_repere():
    assert est_marque_repere({"marque": "TURINI", "ean": "3564700123456"})  # code-barres Scamark
    assert est_marque_repere({"marque": "Tradilège", "ean": "3661112057565"})  # une gamme, nommée
    assert est_marque_repere({"marque": "Mots d’Enfants", "ean": None})
    assert not est_marque_repere({"marque": "ECO+", "ean": "3564700123456"})  # une autre marque de Leclerc
    assert not est_marque_repere({"marque": "Nos Régions ont du Talent", "ean": "3564706000000"})
    assert not est_marque_repere({"marque": "LACTEL", "ean": "3428270000000"})
    assert not est_marque_repere({"marque": None, "ean": None})


def test_les_logos_de_wikipedia_sont_bien_ranges():
    texte = resources.files("robot_promos").joinpath("logos.json").read_text(encoding="utf-8")
    marques = json.loads(texte)["marques"]
    assert cle_marque(MARQUE_REPERE) in marques
    for marque, logo in marques.items():
        assert marque == cle_marque(marque), marque  # écrite comme cle_marque, pour être retrouvée
        assert logo["image"].startswith("https://upload.wikimedia.org/wikipedia/"), marque
        assert logo["page"].startswith(
            ("https://commons.wikimedia.org/wiki/", "https://fr.wikipedia.org/wiki/", "https://en.wikipedia.org/wiki/")
        ), marque
    assert logos_officiels()[cle_marque(MARQUE_REPERE)] == marques[cle_marque(MARQUE_REPERE)]["image"]
