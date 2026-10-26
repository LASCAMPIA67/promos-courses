"""Tests du chef d'orchestre, avec de fausses sources (aucun accès à internet)."""

import json

from robot_promos import robot
from robot_promos.offres import creer_offre
from robot_promos.sources import Catalogue, Source


class FausseSource(Source):
    id = "lidl"
    magasin = "lidl-lingolsheim"
    nom = "Fausse source"

    def __init__(self, version="v1", panne_catalogues=False, panne_offres=False):
        self.version = version
        self.panne_catalogues = panne_catalogues
        self.panne_offres = panne_offres
        self.lectures = 0

    def catalogues(self, nav):
        if self.panne_catalogues:
            raise ConnectionError("site injoignable")
        return [Catalogue(id="semaine", nom="Semaine", debut="2026-10-22", fin="2099-12-31", version=self.version)]

    def offres(self, nav, catalogue):
        self.lectures += 1
        if self.panne_offres:
            raise ValueError("PDF illisible")
        return [
            creer_offre(
                id="lidl-1",
                source="lidl",
                magasin="lidl-lingolsheim",
                catalogue="semaine",
                produit=f"Banane {self.version}",
                prix=0.95,
                date_fin="2099-12-31",
            )
        ]


def lancer(tmp_path, monkeypatch, source):
    monkeypatch.setattr(robot, "SOURCES", [source])
    monkeypatch.setattr(robot, "Navigateur", lambda: type("Nav", (), {"nb_requetes": 0})())
    sortie = tmp_path / "promos.json"
    code = robot.main(["--sortie", str(sortie)])
    return code, (json.loads(sortie.read_text()) if sortie.exists() else None)


def test_premier_passage(tmp_path, monkeypatch):
    code, doc = lancer(tmp_path, monkeypatch, FausseSource())
    assert code == 0
    assert doc["sources"][0]["etat"] == "ok"
    assert [o["produit"] for o in doc["offres"]] == ["Banane v1"]
    assert doc["sources"][0]["catalogues"][0]["reutilise"] is False


def test_catalogue_inchange_non_relu(tmp_path, monkeypatch):
    lancer(tmp_path, monkeypatch, FausseSource())
    source = FausseSource()
    code, doc = lancer(tmp_path, monkeypatch, source)
    assert code == 0 and source.lectures == 0
    assert doc["sources"][0]["catalogues"][0]["reutilise"] is True
    assert [o["produit"] for o in doc["offres"]] == ["Banane v1"]


def test_catalogue_modifie_relu(tmp_path, monkeypatch):
    lancer(tmp_path, monkeypatch, FausseSource())
    source = FausseSource(version="v2")
    _, doc = lancer(tmp_path, monkeypatch, source)
    assert source.lectures == 1
    assert [o["produit"] for o in doc["offres"]] == ["Banane v2"]


def test_panne_de_lecture_garde_les_offres_de_la_veille(tmp_path, monkeypatch):
    lancer(tmp_path, monkeypatch, FausseSource())
    code, doc = lancer(tmp_path, monkeypatch, FausseSource(version="v2", panne_offres=True))
    assert code == 0
    assert doc["sources"][0]["etat"] == "partiel"
    assert [o["produit"] for o in doc["offres"]] == ["Banane v1"]


def test_toutes_les_sources_en_panne_ne_modifie_rien(tmp_path, monkeypatch):
    lancer(tmp_path, monkeypatch, FausseSource())
    avant = (tmp_path / "promos.json").read_text()
    code, _ = lancer(tmp_path, monkeypatch, FausseSource(panne_catalogues=True))
    assert code == 1
    assert (tmp_path / "promos.json").read_text() == avant
