"""Lidl France (Lingolsheim).

Deux sources, qui se complètent :
- Bonial : quelques promos du magasin (alimentaire compris), avec ancien prix et Lidl Plus ;
- les prospectus officiels de Lidl (service « leaflets » du groupe Schwarz, utilisé par lidl.fr) :
  en France, ils ne détaillent que les produits non alimentaires (outils, cuisine, vêtements…).
"""

import re

from commun import aujourdhui, nettoyer, offre
from sources import bonial

MAGASIN = "lidl-lingolsheim"
PAGE_BONIAL = "https://www.bonial.fr/Lingolsheim/Lidl/p-r1"
PAGE_CATALOGUES = "https://www.lidl.fr/c/catalogues-en-ligne/s10017753"
API_PROSPECTUS = "https://endpoints.leaflets.schwarz/v4/flyer"


def bonial_lingolsheim(nav):
    return bonial.lire_page(nav, PAGE_BONIAL, "lidl_fr_bonial", MAGASIN)


def prospectus(nav):
    page = nav.get(PAGE_CATALOGUES).text
    noms = list(dict.fromkeys(re.findall(r'/l/[a-z0-9-]+/([a-z0-9-]+)/ar/0', page)))
    if not noms:
        raise ValueError("aucun prospectus trouvé sur lidl.fr (le site a peut-être changé)")

    offres, vus, lus = [], set(), []
    aujourd_hui = aujourdhui()
    for nom in noms:
        p = nav.get(API_PROSPECTUS, params={"flyer_identifier": nom, "region_id": 0}).json()["flyer"]
        titre = f"{p.get('title', '')} {p.get('name', '')}"
        if "web" in titre.lower():
            continue  # « Exclus Web » : seulement en ligne, pas en magasin
        debut, fin = p.get("offerStartDate"), p.get("offerEndDate")
        if fin and fin < aujourd_hui:
            continue
        lus.append(titre.strip())
        for produit in (p.get("products") or {}).values():
            if produit["productId"] in vus or not produit.get("price"):
                continue
            vus.add(produit["productId"])
            marque = nettoyer(produit.get("brand"))
            titre_produit = nettoyer(produit["title"])
            if marque and titre_produit.upper().startswith(marque.upper()):
                titre_produit = titre_produit[len(marque):].strip()  # « SILVERCREST Poêle » -> « Poêle »
            offres.append(offre(
                "lidl_fr_prospectus", MAGASIN,
                id=produit["productId"],
                produit=titre_produit,
                marque=marque,
                categorie=(produit.get("wonCategoryPrimary") or "").split("/")[-1],
                prix=float(produit["price"]),
                date_debut=debut,
                date_fin=fin,
                lien=produit.get("url"),
                image=produit.get("image"),
            ))
    remarque = "prospectus lus : " + " / ".join(lus) + " (non alimentaire seulement)"
    return offres, remarque
