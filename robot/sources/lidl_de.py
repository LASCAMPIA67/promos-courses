"""Lidl Allemagne (Kehl-Goldscheuer), via Marktguru.

Marktguru n'a pas d'API officielle, mais son site public utilise une API dont les clés sont
écrites dans la page d'accueil (comme le fait la bibliothèque libre github.com/sydev/marktguru).
On relit ces clés à chaque passage : rien de secret n'est stocké dans le dépôt.
"""

import json
import re

from commun import date_locale, offre

MAGASIN = "lidl-kehl"
CODE_POSTAL = "77694"
ACCUEIL = "https://www.marktguru.de/"
API = "https://api.marktguru.de/api/v1/offers/search"
PAR_PAGE = 500
UNITES = {"kg": "kg", "l": "l", "Stk": "pièce"}


def lire_cles(nav):
    page = nav.get(ACCUEIL).text
    for bloc in re.findall(r'<script\s+type="application/json">(.*?)</script>', page, re.S):
        config = json.loads(bloc).get("config") or {}
        if config.get("apiKey") and config.get("clientKey"):
            return config
    raise ValueError("clés Marktguru introuvables (le site a peut-être changé)")


def lidl_kehl(nav):
    config = lire_cles(nav)
    entetes = {"x-apikey": config["apiKey"], "x-clientkey": config["clientKey"], "Accept": "application/json"}
    sans_marque = config.get("noBrandName", "thisisnobrand123")

    # Chercher « lidl » renvoie toutes les offres Lidl autour du code postal.
    resultats, debut = [], 0
    while True:
        params = {"as": "web", "q": "lidl", "zipCode": CODE_POSTAL, "limit": PAR_PAGE, "offset": debut}
        reponse = nav.get(API, params=params, headers=entetes).json()
        resultats += reponse.get("results") or []
        debut += PAR_PAGE
        if debut >= reponse.get("totalResults", 0):
            break

    offres, en_ligne = [], 0
    for o in resultats:
        if not any(a.get("uniqueName") == "lidl" for a in o.get("advertisers") or []):
            continue
        description = o.get("description") or ""
        if "NUR ONLINE" in description.upper():
            en_ligne += 1
            continue  # vendu seulement sur internet, pas en magasin
        description = re.sub(r"HINWEIS:\s*MIT LIDL PLUS APP", "", description, flags=re.I)
        if description.strip() == "Details im Prospekt":
            description = ""
        marque = (o.get("brand") or {}).get("name")
        dates = o.get("validityDates") or [{}]
        unite = UNITES.get((o.get("unit") or {}).get("shortName"))
        offres.append(offre(
            "lidl_de_marktguru", MAGASIN,
            id=o["id"],
            produit=o["product"]["name"],
            marque=None if marque == sans_marque else marque,
            description=description,
            categorie=(o.get("categories") or [{}])[0].get("name"),
            prix=o["price"],
            ancien_prix=o.get("oldPrice"),
            prix_unitaire=o.get("referencePrice") if unite else None,
            unite=unite,
            date_debut=date_locale(min(d.get("from") or "" for d in dates)),
            date_fin=date_locale(max(d.get("to") or "" for d in dates)),
            carte_fidelite=o.get("requiresLoyalityMembership"),
            lien=f"https://www.marktguru.de/offers/{o['id']}",
            image=f"https://mg2de.b-cdn.net/api/v1/offers/{o['id']}/images/default/0/medium.jpg",
        ))
    remarque = f"{en_ligne} offres « seulement en ligne » ignorées ; pas d'ancien prix chez Marktguru"
    return offres, remarque
