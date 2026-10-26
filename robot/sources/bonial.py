"""Bonial (France) et Kaufda (Allemagne) : la même entreprise, les mêmes pages.

La page d'une enseigne dans une ville contient, cachée dans le code de la page, la liste des
promos en cours. Attention : la page n'en montre qu'une petite partie (16), pas toutes.
"""

import json
import re

from commun import date_locale, offre, prix_unitaire_depuis_texte


def lire_page(nav, url, source, magasin):
    """Renvoie (offres, remarque)."""
    page = nav.get(url).text
    morceau = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', page, re.S)
    if not morceau:
        raise ValueError("données introuvables dans la page (le site a peut-être changé)")
    infos = json.loads(morceau.group(1))["props"]["pageProps"]["pageInformation"]
    bloc = infos["offers"]["main"]

    offres = []
    for o in bloc["items"]:
        p = o["prices"]
        conditions = p.get("conditions") or []
        textes = [c["other"] for c in conditions if c.get("other")]
        prix_u, unite = prix_unitaire_depuis_texte(p.get("priceByBaseUnit"))
        if not prix_u and any(t.lower() in ("le kilo", "1 kg") for t in textes):
            prix_u, unite = p["mainPrice"], "kg"
        offres.append(offre(
            source, magasin,
            id=o["id"],
            produit=o["title"],
            marque=o.get("brand"),
            description=" · ".join(textes),
            categorie=(o.get("categories") or [None])[-1],
            prix=p["mainPrice"],
            ancien_prix=p.get("secondaryPrice") if (p.get("secondaryPrice") or 0) > p["mainPrice"] else None,
            prix_unitaire=prix_u,
            unite=unite,
            reduction=p.get("description"),
            date_debut=date_locale(o.get("validFrom")),
            date_fin=date_locale(o.get("validUntil")),
            carte_fidelite=any((c.get("loyaltyProgram") or {}).get("isCard") for c in conditions),
            lien=url,
            image=((o.get("offerImages") or {}).get("url") or {}).get("normal"),
        ))

    total = bloc.get("totalItems") or len(offres)
    remarque = f"{len(offres)} offres visibles sur {total} (la page n'en montre qu'une partie)"
    return offres, remarque
