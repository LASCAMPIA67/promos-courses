"""L'historique des prix : les promos déjà vues, produit par produit, pour dire si un prix est bon.

À chaque passage, le robot range dans historique.json, pour chaque produit (son code-barres), les
promos vues : le catalogue, les dates et le prix le plus bas pour un article. Avant de les ajouter, il
compare chaque promo en cours aux promos d'avant du même produit, et l'écrit dans promos.json
(« historique » de chaque offre) : le prix le plus bas vu, le même que le meilleur, ou déjà vu moins
cher. L'historique a commencé vide le 28/10/2026 : les comparaisons arrivent au fil des semaines.
Format : docs/format-promos.md.
"""

import json
from datetime import date, timedelta
from pathlib import Path

FORMAT = 1  # version du format de historique.json
DUREE = 2 * 365  # une promo est gardée deux ans après sa fin


def prix_article(offre):
    """Le prix le plus bas pour un article : celui du lot quand il est moins cher, sinon le prix.

    Comme l'appli, on ne croit pas un lot qui coûte moins qu'un seul article (« -50 % sur le 2e » au
    prix d'un seul : une erreur du catalogue), sauf pour un article offert.
    """
    prix, lot = offre.get("prix"), offre.get("lot")
    offert = "offert" in (offre.get("reduction") or "").lower()
    if lot and lot.get("prix") and lot.get("quantite") and (prix is None or lot["prix"] > prix or offert):
        par_article = round(lot["prix"] / lot["quantite"], 2)
        return min(prix, par_article) if prix else par_article
    return prix or None


def prix_habituel(offre):
    """Le prix habituel d'un article, quand le catalogue le donne : l'ancien prix barré (ou, pour un
    Ticket E.Leclerc, le prix payé en caisse) ; pour une promo sur le lot (« 2e à -60 % »), le prix
    d'un seul article. None sinon."""
    if offre.get("ancien_prix"):
        return offre["ancien_prix"]
    if offre.get("lot") and offre.get("prix") and not offre.get("carte_fidelite"):
        return offre["prix"]
    return None


def lire(chemin):
    """L'historique enregistré (vide s'il n'existe pas encore)."""
    try:
        historique = json.loads(Path(chemin).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"format": FORMAT, "debut": None, "produits": {}}
    if historique.get("format") != FORMAT:
        raise ValueError(f"format d'historique inconnu : {historique.get('format')}")
    return historique


def comparer(historique, offre):
    """Ce que dit l'historique de cette promo, ou None faute de promo plus ancienne du même produit.

    On compare le prix le plus bas pour un article aux promos qui ont commencé avant celle-ci :
    « plus_bas » (jamais vu aussi bas), « egal » (le même que le meilleur) ou « plus_cher ».
    """
    produit = historique["produits"].get(offre.get("ean") or "")
    prix = prix_article(offre)
    if not produit or prix is None or not offre.get("date_debut"):
        return None
    avant = [
        p
        for p in produit["promos"]
        if p["du"] < offre["date_debut"] and (p["catalogue"], p["du"]) != (offre["catalogue"], offre["date_debut"])
    ]
    if not avant:
        return None
    meilleure = max(avant, key=lambda p: (-p["prix"], p["du"]))  # la moins chère ; à égalité, la dernière
    if prix < meilleure["prix"]:
        verdict = "plus_bas"
    elif prix == meilleure["prix"]:
        verdict = "egal"
    else:
        verdict = "plus_cher"
    return {
        "verdict": verdict,
        "depuis": min(p["du"] for p in avant),
        "promos": len(avant),
        "meilleur_prix": meilleure["prix"],
        "meilleur_le": meilleure["du"],
    }


def ajouter(historique, offres, jour):
    """Range les promos en cours dans l'historique (une seule fois chacune, même avec plusieurs passages
    par jour) et oublie celles finies depuis plus de deux ans. `jour` : la date du passage."""
    historique["debut"] = historique.get("debut") or jour
    produits = historique["produits"]
    for offre in offres:
        prix = prix_article(offre)
        if not offre.get("ean") or prix is None or not offre.get("date_debut"):
            continue
        produit = produits.setdefault(offre["ean"], {"produit": None, "marque": None, "promos": []})
        produit["produit"], produit["marque"] = offre["produit"], offre.get("marque")
        promo = {"catalogue": offre["catalogue"], "du": offre["date_debut"], "au": offre.get("date_fin"), "prix": prix}
        if prix_habituel(offre):
            promo["prix_habituel"] = prix_habituel(offre)
        deja = [p for p in produit["promos"] if (p["catalogue"], p["du"]) == (promo["catalogue"], promo["du"])]
        if deja:
            deja[0]["au"] = promo["au"]
            deja[0]["prix"] = min(deja[0]["prix"], prix)  # deux offres du même produit : la moins chère
            if "prix_habituel" in promo:
                deja[0]["prix_habituel"] = promo["prix_habituel"]
        else:
            produit["promos"].append(promo)
        produit["promos"].sort(key=lambda p: (p["du"], p["catalogue"]))
    limite = (date.fromisoformat(jour) - timedelta(days=DUREE)).isoformat()
    for ean in list(produits):
        produits[ean]["promos"] = [p for p in produits[ean]["promos"] if (p["au"] or p["du"]) >= limite]
        if not produits[ean]["promos"]:
            del produits[ean]
    historique["produits"] = dict(sorted(produits.items()))
    return historique


def ecrire(chemin, historique):
    """Une ligne par produit : le fichier reste lisible, et ses changements d'un jour à l'autre, petits."""
    lignes = [f"  {json.dumps(ean)}: {json.dumps(p, ensure_ascii=False)}" for ean, p in historique["produits"].items()]
    entete = f'{{\n "format": {historique["format"]},\n "debut": {json.dumps(historique["debut"])},\n "produits": {{\n'
    Path(chemin).write_text(entete + ",\n".join(lignes) + "\n }\n}\n", encoding="utf-8")


def mettre_a_jour(chemin, offres, jour):
    """Compare chaque promo à l'historique (champ « historique » de l'offre), puis l'y ajoute et
    enregistre le fichier. Renvoie le nombre de promos comparées."""
    historique = lire(chemin)
    for offre in offres:
        offre["historique"] = comparer(historique, offre)
    ecrire(chemin, ajouter(historique, offres, jour))
    return sum(1 for offre in offres if offre["historique"])
