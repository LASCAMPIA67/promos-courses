"""Outils partagés par toutes les sources : téléchargement poli, magasins, mise en forme des offres."""

import html
import re
import time
from datetime import datetime
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

import requests

# On se présente honnêtement aux sites visités.
USER_AGENT = "Mozilla/5.0 (compatible; promos-courses/1.0; +https://github.com/lascampia67/promos-courses)"

# Pause minimale entre deux requêtes (en secondes), quel que soit le site.
PAUSE = 3

FUSEAU = ZoneInfo("Europe/Paris")  # Paris et Kehl ont la même heure

# Nos magasins. On ne garde que l'enseigne et la ville : pas besoin de plus.
MAGASINS = {
    "lidl-lingolsheim": {"nom": "Lidl Lingolsheim", "enseigne": "Lidl", "ville": "Lingolsheim", "pays": "FR", "langue": "fr"},
    "lidl-kehl": {"nom": "Lidl Kehl-Goldscheuer", "enseigne": "Lidl", "ville": "Kehl", "pays": "DE", "langue": "de"},
    "dm-kehl": {"nom": "dm Kehl-Goldscheuer", "enseigne": "dm", "ville": "Kehl", "pays": "DE", "langue": "de"},
}


class Interdit(Exception):
    """Le fichier robots.txt du site interdit cette adresse."""


class Navigateur:
    """Télécharge des pages en respectant robots.txt et en faisant des pauses."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self.robots = {}  # hôte -> (règles, délai demandé)
        self.derniere_requete = 0.0

    def _attendre(self, delai):
        reste = self.derniere_requete + max(PAUSE, delai) - time.monotonic()
        if reste > 0:
            time.sleep(reste)
        self.derniere_requete = time.monotonic()

    def _regles(self, hote):
        if hote not in self.robots:
            self._attendre(0)
            r = self.session.get(f"https://{hote}/robots.txt", timeout=30)
            if r.status_code == 200:
                self.robots[hote] = lire_robots(r.text)
            elif 400 <= r.status_code < 500:
                self.robots[hote] = ([], 0)  # pas de robots.txt : tout est permis
            else:
                r.raise_for_status()
        return self.robots[hote]

    def get(self, url, params=None, headers=None):
        url = requests.Request("GET", url, params=params).prepare().url
        morceaux = urlsplit(url)
        regles, delai = self._regles(morceaux.netloc)
        chemin = morceaux.path + ("?" + morceaux.query if morceaux.query else "")
        if not est_autorise(regles, chemin):
            raise Interdit(f"robots.txt interdit {url}")
        self._attendre(delai)
        r = self.session.get(url, headers=headers, timeout=60)
        r.raise_for_status()
        return r


def lire_robots(texte):
    """Lit un robots.txt et renvoie (règles pour « * », délai demandé entre requêtes)."""
    regles, delai = [], 0
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
        dans_regles = True
        if "*" not in agents:
            continue
        if cle in ("allow", "disallow") and valeur:
            regles.append((cle == "allow", valeur))
        elif cle == "crawl-delay":
            try:
                delai = float(valeur)
            except ValueError:
                pass
    return regles, delai


def est_autorise(regles, chemin):
    """Applique les règles robots.txt (la règle la plus précise gagne, comme chez Google)."""
    meilleure = (-1, True)
    for permis, motif in regles:
        regex = re.escape(motif).replace(r"\*", ".*")
        if regex.endswith(r"\$"):
            regex = regex[:-2] + "$"
        if re.match(regex, chemin) and (len(motif), permis) > meilleure:
            meilleure = (len(motif), permis)
    return meilleure[1]


def date_locale(texte):
    """« 2026-10-25T23:00:00Z » -> « 2026-10-26 » (date à l'heure de Paris)."""
    if not texte:
        return None
    texte = texte.replace("Z", "+00:00")
    texte = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", texte)  # +0000 -> +00:00
    return datetime.fromisoformat(texte).astimezone(FUSEAU).date().isoformat()


def maintenant():
    return datetime.now(FUSEAU).replace(microsecond=0).isoformat()


def aujourdhui():
    return datetime.now(FUSEAU).date().isoformat()


def nettoyer(texte):
    """Enlève les balises HTML, les ® et les espaces en trop."""
    if not texte:
        return None
    texte = html.unescape(re.sub(r"<[^>]+>", " ", texte))
    texte = texte.replace("®", "").replace("­", "")
    texte = re.sub(r"\s+", " ", texte).strip()
    return texte or None


def prix_unitaire_depuis_texte(texte):
    """Trouve un prix au kilo/litre/pièce dans un texte.

    Exemples : « 5,69 € le kg », « 1 kg = 0,99 € », « EUR 12,67 / 1 kg », « EUR 1,20 / 100 g ».
    Renvoie (prix, unité) avec l'unité parmi « kg », « l », « pièce », ou (None, None).
    """
    if not texte:
        return None, None
    t = texte.lower().replace(",", ".")
    unite = re.search(r"\b(kg|kilo|litre|ml|cl|stk|stück|st|pièce|g|l)(?![\w'’])", t)
    if not unite:
        return None, None
    u = unite.group(1)
    # La quantité de référence est le nombre collé juste avant l'unité (« 100 g », « 1 kg »).
    quantite = re.search(r"(\d+(?:\.\d+)?)\s*" + u + r"(?![\w'’])", t)
    if quantite:
        t = t[:quantite.start()] + t[quantite.end():]
        quantite = float(quantite.group(1)) or 1.0
    else:
        quantite = 1.0
    prix = re.findall(r"\d+(?:\.\d+)?", t)
    if not prix:
        return None, None
    valeur = float(prix[0])
    if u in ("kg", "kilo"):
        return round(valeur / quantite, 2), "kg"
    if u == "g":
        return round(valeur * 1000 / quantite, 2), "kg"
    if u in ("l", "litre"):
        return round(valeur / quantite, 2), "l"
    if u == "ml":
        return round(valeur * 1000 / quantite, 2), "l"
    if u == "cl":
        return round(valeur * 100 / quantite, 2), "l"
    return round(valeur / quantite, 2), "pièce"


def reduction_calculee(prix, ancien_prix):
    if prix and ancien_prix and ancien_prix > prix:
        return f"-{round((1 - prix / ancien_prix) * 100)}%"
    return None


def offre(source, magasin, *, id, produit, prix, marque=None, description=None, ancien_prix=None,
          prix_unitaire=None, unite=None, reduction=None, date_debut=None, date_fin=None,
          carte_fidelite=False, lien=None, image=None, categorie=None):
    """Fabrique une offre avec toujours les mêmes champs, dans le même ordre."""
    infos = MAGASINS[magasin]
    return {
        "id": f"{source}-{id}",
        "source": source,
        "magasin": magasin,
        "pays": infos["pays"],
        "langue": infos["langue"],
        "produit": nettoyer(produit),
        "marque": nettoyer(marque),
        "description": nettoyer(description),
        "categorie": nettoyer(categorie),
        "prix": prix,
        "ancien_prix": ancien_prix or None,
        "prix_unitaire": prix_unitaire or None,
        "unite": unite if prix_unitaire else None,
        "reduction": nettoyer(reduction) or reduction_calculee(prix, ancien_prix),
        "date_debut": date_debut,
        "date_fin": date_fin,
        "carte_fidelite": bool(carte_fidelite),
        "lien": lien,
        "image": image,
    }
