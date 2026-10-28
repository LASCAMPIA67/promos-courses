"""Le format d'une offre, et la vérification du fichier promos.json avant de l'écrire."""

import json
import re
from importlib import resources

import jsonschema

from robot_promos.outils import nettoyer, nombre

UNITES = ("kg", "l", "pièce")


def creer_offre(
    *,
    id,
    source,
    magasin,
    catalogue,
    produit,
    prix,
    marque=None,
    description=None,
    categorie=None,
    ean=None,
    ancien_prix=None,
    prix_unitaire=None,
    unite=None,
    reduction=None,
    lot=None,
    carte_fidelite=False,
    date_debut=None,
    date_fin=None,
    lien=None,
    image=None,
    page=None,
    logo_catalogue=None,
):
    """Fabrique une offre avec toujours les mêmes champs, dans le même ordre.

    - prix : ce que coûte UN article (avec la carte de fidélité si `carte_fidelite` est vrai).
    - ancien_prix : le prix habituel, quand le catalogue l'indique.
    - lot : l'avantage quand il faut en acheter plusieurs (« 2e à -60 % », « 2+1 offert »).
    """
    prix, ancien_prix = nombre(prix), nombre(ancien_prix)
    if ancien_prix and prix and ancien_prix <= prix:
        ancien_prix = None
    prix_unitaire = nombre(prix_unitaire)
    unite = unite if prix_unitaire and unite in UNITES else None
    if lot:
        lot = {
            "quantite": int(lot["quantite"]),
            "prix": nombre(lot.get("prix")),
            "prix_unitaire": nombre(lot.get("prix_unitaire")) if unite else None,
        }
    if reduction is None and prix and ancien_prix:
        reduction = f"-{round((1 - prix / ancien_prix) * 100)} %"
    if reduction:
        reduction = re.sub(r"(\d) ?([%€])", r"\1 \2", reduction)  # « -34% » -> « -34 % »
    return {
        "id": id,
        "source": source,
        "magasin": magasin,
        "catalogue": catalogue,
        "produit": nettoyer(produit) or "?",
        "marque": nettoyer(marque),
        "description": nettoyer(description, longueur_max=300),
        "categorie": nettoyer(categorie),
        "ean": ean or None,
        "prix": prix,
        "ancien_prix": ancien_prix,
        "prix_unitaire": prix_unitaire if unite else None,
        "unite": unite,
        "reduction": nettoyer(reduction),
        "lot": lot or None,
        "carte_fidelite": bool(carte_fidelite),
        "date_debut": date_debut,
        "date_fin": date_fin,
        "lien": lien,
        "image": image,
        "page": page,
        "logo_catalogue": logo_catalogue,
    }


def dedoublonner(offres):
    """Enlève les offres en double (même produit, même prix, mêmes dates) en gardant la plus complète.

    Le code-barres suffit à reconnaître le produit : une même promo peut paraître dans deux catalogues
    avec une marque écrite différemment (« FRUIT SHOOT » et « TEISSEIRE »). Sans code-barres, on
    compare le nom et la marque.
    """
    gardees = {}
    for o in offres:
        produit = ("ean", o["ean"]) if o["ean"] else ("nom", (o["produit"] or "").lower(), (o["marque"] or "").lower())
        cle = (o["magasin"], produit, o["prix"], o["date_debut"], o["date_fin"])
        avant = gardees.get(cle)
        if avant is None or len(json.dumps(o, ensure_ascii=False)) > len(json.dumps(avant, ensure_ascii=False)):
            gardees[cle] = o
    # Les identifiants doivent rester uniques.
    vus, resultat = {}, []
    for o in gardees.values():
        n = vus.get(o["id"], 0)
        vus[o["id"]] = n + 1
        if n:
            o = {**o, "id": f"{o['id']}-{n + 1}"}
        resultat.append(o)
    return resultat


def schema():
    return json.loads(resources.files("robot_promos").joinpath("promos.schema.json").read_text(encoding="utf-8"))


def verifier(document):
    """Lève une erreur si promos.json ne respecte pas son format (voir promos.schema.json)."""
    jsonschema.validate(document, schema(), cls=jsonschema.Draft202012Validator)
