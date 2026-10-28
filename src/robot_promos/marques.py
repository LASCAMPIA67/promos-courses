"""Les marques : les produits Marque Repère, et les logos officiels pris sur Wikipédia.

Les produits Marque Repère (la marque des centres E.Leclerc) se reconnaissent à leur code-barres :
ceux de Scamark, qui les fabrique pour Leclerc, commencent par 356470. Quelques gammes de la marque
ont d'autres codes-barres : elles sont reconnues à leur nom, tel qu'il figure dans le dossier de
presse des 25 ans de Marque Repère (2022). Mots d'Enfants n'est Marque Repère que pour ses couches et
ses soins (au code-barres de Scamark), pas pour ses vêtements. Eco+ et Nos Régions ont du Talent sont
d'autres marques de Leclerc : elles gardent leur logo. Voir docs/sources.md.
"""

import json
from importlib import resources

MARQUE_REPERE = "Marque Repère"
PREFIXE_MARQUE_REPERE = "356470"
GAMMES_MARQUE_REPERE = {
    "MARQUE REPÈRE",
    "BIO VILLAGE",
    "COPAINS COPINES",
    "DÉLISSE",
    "ŒUFS DE NOS RÉGIONS",
    "POM'LISSE",
    "RÉCOLTONS L'AVENIR",
    "SMICY",
    "SOUTENONS NOS AGRICULTEURS",
    "TRADILÈGE",
    "VOLANDRIE",
}
AUTRES_MARQUES_LECLERC = {"ECO+", "NOS RÉGIONS ONT DU TALENT"}

# Les gammes que le catalogue écrit comme une marque à part, vérifiées une par une : sans logo à elles,
# elles prennent celui de leur marque. Pas de règle automatique : « LOTUS BABY » (des couches) n'est
# pas une gamme de LOTUS (des biscuits).
SOUS_MARQUES = {
    "DISNEY - STITCH": "DISNEY",
    "MONSTER MUNCH CRAZY": "MONSTER MUNCH",
    "PANIER DE YOPLAIT": "YOPLAIT",
}


def cle_marque(marque):
    """La même marque, écrite « Foxter », « FOXTER » ou « Mots d’Enfants » : « FOXTER », « MOTS D'ENFANTS »."""
    return " ".join((marque or "").replace("’", "'").upper().split())


def est_marque_repere(offre):
    """Vrai pour un produit Marque Repère (d'après son code-barres, sinon le nom de sa gamme)."""
    marque = cle_marque(offre.get("marque"))
    if marque in AUTRES_MARQUES_LECLERC:
        return False
    return (offre.get("ean") or "").startswith(PREFIXE_MARQUE_REPERE) or marque in GAMMES_MARQUE_REPERE


def logos_officiels():
    """Les logos vérifiés un par un sur Wikipédia (logos.json) : marque (comme cle_marque) -> adresse."""
    texte = resources.files("robot_promos").joinpath("logos.json").read_text(encoding="utf-8")
    return {cle_marque(marque): logo["image"] for marque, logo in json.loads(texte)["marques"].items()}
