"""Petits outils partagés : dates, textes, nombres."""

import html
import re
from datetime import datetime

from robot_promos.config import FUSEAU


def maintenant():
    return datetime.now(FUSEAU).replace(microsecond=0).isoformat()


def aujourdhui():
    return datetime.now(FUSEAU).date().isoformat()


def nettoyer(texte, longueur_max=None):
    """Enlève les balises HTML, les ®/™, les césures et les espaces en trop."""
    if not texte:
        return None
    texte = html.unescape(re.sub(r"<[^>]+>", " ", str(texte)))
    texte = re.sub(r"[®™­]", "", texte)
    texte = re.sub(r"(\w)- (\w)", lambda m: m.group(1) + ("-" if m.group(2).isupper() else "") + m.group(2), texte)
    texte = re.sub(r"\s+", " ", texte).strip(" .,;")
    if longueur_max and len(texte) > longueur_max:
        texte = texte[: longueur_max - 1].rsplit(" ", 1)[0] + "…"
    return texte or None


def nombre(texte):
    """« 2,57 » ou « 2.57 » -> 2.57 ; renvoie None si ce n'est pas un nombre (ou s'il vaut 0)."""
    if texte in (None, ""):
        return None
    try:
        valeur = float(str(texte).replace(",", ".").replace(" ", ""))
    except ValueError:
        return None
    return round(valeur, 2) if valeur > 0 else None
