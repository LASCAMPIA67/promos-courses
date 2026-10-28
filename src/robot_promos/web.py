"""Téléchargement poli : respect de robots.txt, pauses entre les requêtes, nouvelles tentatives."""

import contextlib
import re
import time
from urllib.parse import urlsplit

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from robot_promos.config import PAUSE, USER_AGENT


class Interdit(Exception):
    """Le fichier robots.txt du site interdit cette adresse."""


class Navigateur:
    """Télécharge des pages en respectant robots.txt et en faisant des pauses."""

    def __init__(self, pause=PAUSE):
        self.pause = pause
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        # En cas de panne passagère du site (erreur 5xx, trop de demandes), on réessaie
        # deux fois en attendant de plus en plus longtemps.
        nouvel_essai = Retry(
            total=2,
            backoff_factor=5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            respect_retry_after_header=True,
        )
        self.session.mount("https://", HTTPAdapter(max_retries=nouvel_essai))
        self.robots = {}  # hôte -> (règles, délai demandé)
        self.derniere_requete = 0.0
        self.nb_requetes = 0

    def _attendre(self, delai):
        reste = self.derniere_requete + max(self.pause, delai) - time.monotonic()
        if reste > 0:
            time.sleep(reste)
        self.derniere_requete = time.monotonic()
        self.nb_requetes += 1

    def _regles(self, hote):
        if hote not in self.robots:
            self._attendre(0)
            r = self.session.get(f"https://{hote}/robots.txt", timeout=30)
            if r.status_code == 200 and "html" not in r.headers.get("Content-Type", ""):
                self.robots[hote] = lire_robots(r.text)
            elif r.status_code == 200 or 400 <= r.status_code < 500:
                # Pas de robots.txt (ou une page web à la place) : tout est permis (RFC 9309, §2.3.1.3).
                self.robots[hote] = ([], 0)
            else:
                r.raise_for_status()
        return self.robots[hote]

    def get(self, url, params=None, headers=None, timeout=60, stream=False):
        """Télécharge `url` si robots.txt l'autorise, après la pause. `stream` : la réponse est lue
        au fur et à mesure (pour un très gros fichier), au lieu d'être gardée en entier."""
        url = requests.Request("GET", url, params=params).prepare().url
        morceaux = urlsplit(url)
        regles, delai = self._regles(morceaux.netloc)
        chemin = morceaux.path + ("?" + morceaux.query if morceaux.query else "")
        if not est_autorise(regles, chemin):
            raise Interdit(f"robots.txt interdit {url}")
        self._attendre(delai)
        r = self.session.get(url, headers=headers, timeout=timeout, stream=stream)
        r.raise_for_status()
        return r


def lire_robots(texte):
    """Lit un robots.txt et renvoie (règles pour « * », délai demandé entre deux requêtes)."""
    regles, delai = [], 0.0
    agents, dans_regles = [], False
    for ligne in texte.splitlines():
        ligne = ligne.split("#", 1)[0].strip()
        if ":" not in ligne:
            continue
        cle, valeur = (x.strip() for x in ligne.split(":", 1))
        cle = cle.lower()
        if cle == "user-agent":
            if dans_regles:
                agents, dans_regles = [], False
            agents.append(valeur.lower())
            continue
        if cle == "sitemap":
            continue
        dans_regles = True
        if "*" not in agents:
            continue
        if cle in ("allow", "disallow") and valeur:
            regles.append((cle == "allow", valeur))
        elif cle == "crawl-delay":
            with contextlib.suppress(ValueError):
                delai = float(valeur)
    return regles, delai


def est_autorise(regles, chemin):
    """Applique les règles robots.txt : la règle la plus précise gagne, « Allow » en cas d'égalité."""
    meilleure = (-1, True)
    for permis, motif in regles:
        regex = re.escape(motif).replace(r"\*", ".*")
        if regex.endswith(r"\$"):
            regex = regex[:-2] + "$"
        if re.match(regex, chemin) and (len(motif), permis) > meilleure:
            meilleure = (len(motif), permis)
    return meilleure[1]
