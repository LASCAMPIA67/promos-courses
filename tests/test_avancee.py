"""Tests de l'avancée du robot (aucun accès à internet : GitHub est simulé)."""

import requests

from robot_promos.avancee import CONTEXTE, Avancee

GITHUB = {"GITHUB_TOKEN": "jeton", "GITHUB_REPOSITORY": "LASCAMPIA67/promos-courses", "GITHUB_SHA": "abc123"}


class FausseSession:
    def __init__(self, panne=False):
        self.headers = {}
        self.envois = []
        self.panne = panne

    def post(self, adresse, json, timeout):
        if self.panne:
            raise requests.ConnectionError("GitHub injoignable")
        self.envois.append((adresse, json))


def test_hors_de_github_rien_n_est_envoye():
    session = FausseSession()
    Avancee(environ={}, session=session)("Catalogue 1 sur 9 : Nos promos", forcer=True)
    assert session.envois == []


def test_sur_github_un_statut_de_l_enregistrement_au_plus_toutes_les_10_secondes():
    secondes = iter([0, 4, 12, 13])
    session = FausseSession()
    avancee = Avancee(environ=GITHUB, session=session, horloge=lambda: next(secondes))
    avancee("Photos : 1 sur 1 450")  # 0 s : envoyé
    avancee("Photos : 2 sur 1 450")  # 4 s : trop tôt
    avancee("Photos : 9 sur 1 450")  # 12 s : envoyé
    avancee("Catalogues lus : 1 393 promos", forcer=True)  # 13 s : envoyé quand même
    assert [description["description"] for _, description in session.envois] == [
        "Photos : 1 sur 1 450",
        "Photos : 9 sur 1 450",
        "Catalogues lus : 1 393 promos",
    ]
    adresse, envoi = session.envois[0]
    assert adresse == "https://api.github.com/repos/LASCAMPIA67/promos-courses/statuses/abc123"
    assert envoi["state"] == "pending"
    assert envoi["context"] == CONTEXTE
    assert session.headers["Authorization"] == "Bearer jeton"


def test_une_ligne_courte_et_jamais_d_arret_si_github_ne_repond_pas():
    session = FausseSession()
    Avancee(environ=GITHUB, session=session)("x" * 300, forcer=True)
    assert len(session.envois[0][1]["description"]) == 140
    Avancee(environ=GITHUB, session=FausseSession(panne=True))("Photos : 3 sur 10", forcer=True)  # pas d'erreur
