"""Petits outils partagés : dates, textes, nombres."""

import html
import re
from datetime import date, datetime, timedelta

from robot_promos.config import FUSEAU

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


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


def date_iso(annee, jour, mois):
    try:
        return date(annee, int(mois), int(jour)).isoformat()
    except ValueError:
        return None


def date_jj_mm(texte, reference):
    """« 22/10 » -> « 2026-10-22 », en choisissant l'année la plus proche de la date de référence."""
    m = re.search(r"(\d{1,2})/(\d{1,2})", texte or "")
    if not m:
        return None
    ref = date.fromisoformat(reference)
    candidates = [date_iso(ref.year + d, m.group(1), m.group(2)) for d in (-1, 0, 1)]
    candidates = [c for c in candidates if c]
    return min(candidates, key=lambda c: abs((date.fromisoformat(c) - ref).days)) if candidates else None


def prochain_jour(depuis, nom_du_jour):
    """Date du prochain « dimanche » (par exemple) à partir de « depuis » (inclus)."""
    d = date.fromisoformat(depuis)
    ecart = (JOURS.index(nom_du_jour.lower()) - d.weekday()) % 7
    return (d + timedelta(days=ecart)).isoformat()


def identifiant(*morceaux):
    """Fabrique un identifiant lisible et stable : « Pain de mie » -> « pain-de-mie »."""
    texte = "-".join(str(m) for m in morceaux if m not in (None, ""))
    texte = re.sub(r"[^a-z0-9]+", "-", texte.lower().translate(str.maketrans("àâäéèêëîïôöùûüç", "aaaeeeeiioouuuc")))
    return texte.strip("-")[:80]
