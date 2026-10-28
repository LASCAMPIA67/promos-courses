"""Où en est le robot, pour l'appli (« Mettre à jour les promos » → fenêtre d'avancée).

Sur GitHub, le robot écrit une ligne courte (« Catalogue 3 sur 9 : Un automne en fête »,
« Photos : 312 sur 1 450 ») dans un « statut » de l'enregistrement qu'il traite, que l'appli lit
pendant le passage. C'est une simple information : si elle ne peut pas être envoyée, le robot
continue. En dehors de GitHub (tests, essais sur un ordinateur), rien n'est envoyé.
"""

import math
import os
import time

import requests

CONTEXTE = "robot-promos/avancee"  # le nom du statut, que l'appli cherche (voir app/src/robot.js)
INTERVALLE = 10  # secondes au moins entre deux nouvelles (l'appli regarde toutes les 10 secondes)


class Avancee:
    def __init__(self, environ=None, session=None, intervalle=INTERVALLE, horloge=time.monotonic):
        environ = os.environ if environ is None else environ
        jeton, depot, enregistrement = (environ.get(n) for n in ("GITHUB_TOKEN", "GITHUB_REPOSITORY", "GITHUB_SHA"))
        self.adresse = (
            f"https://api.github.com/repos/{depot}/statuses/{enregistrement}"
            if jeton and depot and enregistrement
            else None
        )
        self.session = session or requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {jeton}", "Accept": "application/vnd.github+json"})
        self.intervalle = intervalle
        self.horloge = horloge
        self.derniere = -math.inf

    def __call__(self, texte, forcer=False):
        """Donne des nouvelles ; au plus une toutes les `intervalle` secondes, sauf si `forcer`."""
        maintenant = self.horloge()
        if not self.adresse or (not forcer and maintenant - self.derniere < self.intervalle):
            return
        self.derniere = maintenant
        try:
            self.session.post(
                self.adresse,
                json={"state": "pending", "context": CONTEXTE, "description": texte[:140]},
                timeout=10,
            )
        except requests.RequestException as erreur:
            print(f"   (avancée non envoyée : {type(erreur).__name__})", flush=True)


def sans_nouvelles(texte, forcer=False):
    """Pour les essais : pas d'avancée à donner."""
