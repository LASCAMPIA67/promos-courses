"""La base des produits Leclerc, pour trouver un produit même sans promo : nom, marque, contenance, photo.

Sources : Open Food Facts (https://fr.openfoodfacts.org), la base libre des produits alimentaires, et
ses bases sœurs, tenues par la même association : Open Beauty Facts (hygiène, beauté), Open Products
Facts (maison, entretien) et Open Pet Food Facts (animaux). Données sous licence ODbL, photos sous
licence CC BY-SA. Le fichier complet de chacune est publié chaque jour (dossier /data/, permis par
leur robots.txt) : le robot les lit une fois par semaine, au fil du téléchargement, sans les garder.
Il ne retient que les produits vendus en France, avec leur nom, en deux groupes :

- ceux dont on est sûr qu'ils sont chez Leclerc : Marque Repère (code-barres 356470…), ceux que la
  base dit vendus chez Leclerc, et ceux déjà vus dans un catalogue Leclerc (historique.json, avec
  leur dernier prix habituel connu) ;
- les produits courants, avec une photo : scannés par plusieurs personnes dans Open Food Facts ;
  tous ceux des bases sœurs, bien plus petites. Sauf les marques propres des autres enseignes
  (Carrefour, U, Auchan, Lidl…), qu'on ne trouve pas chez Leclerc.

Si une base sœur est injoignable, les autres suffisent (c'est noté dans produits.json) ; sans Open
Food Facts, produits.json n'est pas modifié. Les photos des produits déjà vus dans un catalogue
Leclerc s'y ajoutent dans l'appli (vignettes.json de la branche « photos », voir photos.py).

Résultat : produits.json, lu par l'appli. Les prix de tous les produits ne sont que sur Leclerc
Drive, qui bloque les robots : voir docs/sources.md.

Lancement : python -m robot_promos.produits   (options : --help)
"""

import argparse
import csv
import gzip
import io
import json
import os
import re
import sys
import unicodedata
from pathlib import Path
from typing import NamedTuple

from robot_promos.historique import lire as lire_historique
from robot_promos.marques import PREFIXE_MARQUE_REPERE, est_marque_repere
from robot_promos.outils import maintenant, nettoyer
from robot_promos.web import Navigateur

FORMAT = 1  # version du format de produits.json (voir docs/format-promos.md)


class Base(NamedTuple):
    nom: str
    fichier: str  # le fichier complet, publié chaque jour
    photos: str  # l'adresse des photos, rangées par code-barres
    scans: int  # un produit courant : scanné par au moins autant de personnes


def _base(nom, site, scans):
    return Base(
        nom, f"https://static.{site}/data/en.{site}.products.csv.gz", f"https://images.{site}/images/products/", scans
    )


# Open Food Facts d'abord : un produit présent dans deux bases garde sa fiche d'Open Food Facts.
BASES = {
    "off": _base("Open Food Facts", "openfoodfacts.org", 3),
    "obf": _base("Open Beauty Facts", "openbeautyfacts.org", 0),
    "opf": _base("Open Products Facts", "openproductsfacts.org", 0),
    "opff": _base("Open Pet Food Facts", "openpetfoodfacts.org", 0),
}
PRINCIPALE = "off"  # sans elle, pas de nouvelle base des produits
LICENCE = (
    "Open Food Facts, Open Beauty Facts, Open Products Facts et Open Pet Food Facts "
    "(https://fr.openfoodfacts.org) : données sous licence ODbL, photos sous licence CC BY-SA."
)

COLONNES = ["ean", "nom", "marque", "quantite", "photo", "leclerc", "prix_habituel", "prix_vu_le"]
MARQUE_REPERE, CHEZ_LECLERC, EN_FRANCE = 2, 1, 0  # colonne « leclerc » : ce qu'on sait du produit

# Les marques propres des autres enseignes : on ne les trouve pas chez Leclerc.
AUTRES_ENSEIGNES = {
    # Carrefour, Auchan, Système U, Casino, Monoprix, Intermarché, Lidl, Aldi et les autres.
    "carrefour", "carrefour bio", "carrefour classic", "carrefour extra", "carrefour sensation",
    "carrefour original", "carrefour discount", "carrefour selection", "carrefour kids", "carrefour veggie",
    "carrefour baby", "simpl", "reflets de france", "auchan", "auchan bio", "mmm", "pouce", "u", "u bio",
    "u saveurs", "bien vu", "marque u", "les produits u", "casino", "casino bio", "casino delices",
    "tous les jours", "monoprix", "monoprix bio", "monoprix gourmet", "franprix", "leader price", "cora",
    "match", "intermarche", "paturages", "chabrior", "top budget", "itineraire des saveurs",
    "monique ranou", "fiorini", "saint eloi", "netto", "lidl", "milbona", "cien", "chef select",
    "belbake", "deluxe", "freeway", "crownfield", "snack day", "pilos", "solevita", "combino", "alesto",
    "fin carre", "tastino", "envia", "vitasia", "italiamo", "sondey", "nixe", "lupilu", "w5", "bellarom",
    "trattoria alfredo", "dulano", "gelatelli", "favorina", "mcennedy", "aldi", "milsani", "lyttos",
    "moser roth", "picard", "grand jury", "super u", "systeme u", "carrefour france", "la vie claire",
    "belle france", "grand frais", "thiriet", "biocoop", "naturalia", "coop", "dia", "decathlon",
}  # fmt: skip
# Un de ces mots dans le nom de la marque suffit (« Carrefour Classic' », « CMI (Carrefour …) »).
MOTS_AUTRES_ENSEIGNES = {
    "carrefour",
    "auchan",
    "lidl",
    "intermarche",
    "monoprix",
    "franprix",
    "tesco",
    "delhaize",
    "migros",
    "conad",
}
# Les codes-barres de ces enseignes (préfixes de leur entreprise, vérifiés sur Open Food Facts).
PREFIXES_AUTRES_ENSEIGNES = ("3560070", "3270190", "325622", "3596710", "325039", "4056489")
# Les codes-barres des pays dont les produits se vendent en France (le début du code, GS1).
PREFIXES_EUROPE = re.compile(
    r"^(3[0-7]|38[0357]|4[0-4]|47[0-7]|50|52[019]|53[59]|54|56[09]|57|59[049]|64|70|73|76|8[0-4]|85[89]|87|9[01])"
)
PREFIXES_FRANCE = re.compile(r"^3[0-7]")  # un produit fabriqué pour la France

csv.field_size_limit(2**31 - 1)  # certaines lignes ont des champs très longs


def lignes_open_food_facts(source, nav=None):
    """Les produits d'un fichier complet (adresse ou fichier .csv.gz), un dictionnaire par produit."""
    if source.startswith("https://"):
        source = (nav or Navigateur()).get(source, timeout=300, stream=True).raw  # lu au fil de l'eau
    with gzip.open(source) as fichier:
        texte = io.TextIOWrapper(fichier, encoding="utf-8", errors="replace", newline="")
        yield from csv.DictReader(texte, delimiter="\t", quoting=csv.QUOTE_NONE)


def marque_principale(marques):
    """« Marque Repère, Notre Jardin » -> « Notre Jardin » : la gamme plutôt que la marque Leclerc."""
    liste = [m.strip() for m in (marques or "").split(",") if m.strip()]
    precises = [m for m in liste if m.lower().replace("è", "e") != "marque repere"]
    return (precises or liste or [None])[0]


def prix_connus(historique):
    """Code-barres -> (dernier prix habituel connu, date de début de cette promo), d'après l'historique."""
    prix = {}
    for ean, produit in historique["produits"].items():
        avec = [p for p in produit["promos"] if p.get("prix_habituel")]
        if avec:
            dernier = max(avec, key=lambda p: p["du"])
            prix[ean] = (dernier["prix_habituel"], dernier["du"])
    return prix


def sans_accents(texte):
    return "".join(c for c in unicodedata.normalize("NFD", texte) if unicodedata.category(c) != "Mn")


def autre_enseigne(ean, marques):
    """Vrai pour un produit de la marque propre d'une autre enseigne (Carrefour, U, Lidl…)."""
    noms = {" ".join(re.split(r"[^a-z0-9]+", sans_accents(m).lower())).strip() for m in (marques or "").split(",")}
    mots = {mot for nom in noms for mot in nom.split()}
    return bool(noms & AUTRES_ENSEIGNES or mots & MOTS_AUTRES_ENSEIGNES) or ean.startswith(PREFIXES_AUTRES_ENSEIGNES)


def vendu_en_france(ean, pays):
    """Dit vendu en France ; ou, sans pays indiqué, un code-barres français (30 à 37)."""
    return "en:france" in (pays or "") or (not (pays or "").strip() and bool(PREFIXES_FRANCE.match(ean)))


def fichier_photo(ean, adresse, code=PRINCIPALE):
    """« …/356/470/000/0229/front_fr.9.200.jpg » -> « front_fr.9 » (l'appli refait le reste), ou None.
    Une photo d'une base sœur porte son code : « obf:front_fr.3 »."""
    dossier = f"{ean[:3]}/{ean[3:6]}/{ean[6:9]}/{ean[9:]}" if len(ean) == 13 else ean
    motif = re.escape(f"{BASES[code].photos}{dossier}/") + r"([a-z_]+\.\d+)\.200\.jpg"
    trouve = re.fullmatch(motif, adresse or "")
    if not trouve:
        return None
    return trouve.group(1) if code == PRINCIPALE else f"{code}:{trouve.group(1)}"


def nombre_de_scans(ligne):
    try:
        return int(float(ligne.get("unique_scans_n") or 0))
    except ValueError:
        return 0


def produits_de_la_base(code, lignes, vus, scans=None):
    """Les produits retenus d'une base (`code` : off, obf…), d'après ses lignes. `vus` : les produits
    déjà vus dans un catalogue Leclerc (historique). Renvoie code-barres -> (ligne pour produits.json
    sans les prix, nombre de scans)."""
    scans = BASES[code].scans if scans is None else scans
    retenus = {}
    for ligne in lignes:
        ean = (ligne.get("code") or "").strip()
        if not ean.isdigit() or not vendu_en_france(ean, ligne.get("countries_tags")):
            continue
        nom = nettoyer(ligne.get("product_name_fr") or ligne.get("product_name"), longueur_max=120)
        if not nom or autre_enseigne(ean, ligne.get("brands")):
            continue
        photo = fichier_photo(ean, ligne.get("image_small_url"), code)
        if ean.startswith(PREFIXE_MARQUE_REPERE):
            leclerc = MARQUE_REPERE
        elif "leclerc" in (ligne.get("stores") or "").lower() or ean in vus:
            leclerc = CHEZ_LECLERC
        elif photo and len(ean) == 13 and PREFIXES_EUROPE.match(ean) and nombre_de_scans(ligne) >= scans:
            leclerc = EN_FRANCE
        else:
            continue
        marque = nettoyer(marque_principale(ligne.get("brands")), longueur_max=60)
        quantite = nettoyer(ligne.get("quantity"), longueur_max=40)
        retenus[ean] = ([ean, nom, marque, quantite, photo, leclerc], nombre_de_scans(ligne))
    return retenus


def choisir(par_base, historique):
    """Les produits pour produits.json, d'après ceux retenus dans chaque base (dans l'ordre de BASES) :
    ceux qu'on sait chez Leclerc d'abord, puis les plus scannés. Chaque produit : [ean, nom, marque,
    quantité, photo, leclerc, prix habituel, prix vu le] (COLONNES)."""
    vus = historique["produits"]
    prix = prix_connus(historique)
    produits = {}
    for retenus in par_base:
        for ean, produit in retenus.items():
            produits.setdefault(ean, produit)
    # Les produits vus dans un catalogue Leclerc qu'aucune base ne connaît : sans photo ici (l'appli
    # prend celle du catalogue, voir photos.py).
    for ean, produit in vus.items():
        if ean not in produits and produit.get("produit"):
            produits[ean] = ([ean, produit["produit"], produit.get("marque"), None, None, CHEZ_LECLERC], 0)
    for ean, (ligne, _) in produits.items():
        if ligne[5] == CHEZ_LECLERC and est_marque_repere({"ean": ean, "marque": ligne[2]}):
            ligne[5] = MARQUE_REPERE  # une gamme Marque Repère à un autre code-barres (Tradilège)
        ligne.extend(prix.get(ean, (None, None)))
    rang = sorted(produits.values(), key=lambda p: (-p[0][5], -p[1], p[0][0]))
    return [ligne for ligne, _ in rang]


def ecrire(chemin, produits, sources):
    """Un produit par ligne : le fichier reste lisible, et ses changements d'une semaine à l'autre, petits."""
    entete = {
        "format": FORMAT,
        "mise_a_jour": maintenant(),
        "licence": LICENCE,
        "sources": sources,
        "photos": {code: base.photos for code, base in BASES.items()},
        "colonnes": COLONNES,
    }
    debut = json.dumps(entete, ensure_ascii=False, indent=1)[:-2]
    lignes = ",\n".join(json.dumps(p, ensure_ascii=False, separators=(",", ":")) for p in produits)
    Path(chemin).write_text(f'{debut},\n "produits": [\n{lignes}\n ]\n}}\n', encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m robot_promos.produits", description=__doc__.splitlines()[0])
    parser.add_argument(
        "--bases", default=",".join(BASES), help=f"bases à lire, dans cet ordre (par défaut : {','.join(BASES)})"
    )
    parser.add_argument(
        "--source",
        action="append",
        default=[],
        metavar="BASE=FICHIER",
        help="lire une base depuis ce fichier .csv.gz ou cette adresse (par exemple off=off.csv.gz)",
    )
    parser.add_argument(
        "--historique", default="historique.json", help="historique des prix (par défaut : historique.json)"
    )
    parser.add_argument("--sortie", default="produits.json", help="fichier à écrire (par défaut : produits.json)")
    parser.add_argument(
        "--scans", type=int, help=f"scans pour un produit courant d'Open Food Facts (par défaut : {BASES['off'].scans})"
    )
    args = parser.parse_args(argv)
    codes = [code for code in args.bases.split(",") if code]
    if PRINCIPALE not in codes or any(code not in BASES for code in codes):
        parser.error(f"--bases : parmi {', '.join(BASES)}, dont {PRINCIPALE}")
    fichiers = {code: base.fichier for code, base in BASES.items()} | dict(s.split("=", 1) for s in args.source)

    historique = lire_historique(args.historique)
    nav = Navigateur()
    par_base, sources = [], []
    for code in codes:
        base = BASES[code]
        print(f"→ {base.nom}…", flush=True)
        try:
            lignes = lignes_open_food_facts(fichiers[code], nav)
            retenus = produits_de_la_base(code, lignes, historique["produits"], args.scans if code == "off" else None)
        except Exception as erreur:  # noqa: BLE001 — une base sœur injoignable : les autres suffisent
            message = f"{type(erreur).__name__} : {erreur}"[:300]
            print(f"   {base.nom} illisible : {message}", flush=True)
            if code == PRINCIPALE:
                print("Sans Open Food Facts : produits.json n'est pas modifié.")
                return 1
            sources.append({"nom": base.nom, "etat": "erreur", "message": message})
            continue
        print(f"   {len(retenus)} produits retenus.", flush=True)
        par_base.append(retenus)
        sources.append({"nom": base.nom, "etat": "ok", "produits": len(retenus)})

    produits = choisir(par_base, historique)
    ecrire(args.sortie, produits, sources)
    surs = sum(1 for p in produits if p[5] != EN_FRANCE)
    avec_photo = sum(1 for p in produits if p[4])
    avec_prix = sum(1 for p in produits if p[6])
    detail = ", ".join(
        f"{s['nom']} : {s['produits']}" if s["etat"] == "ok" else f"{s['nom']} : injoignable" for s in sources
    )
    phrase = (
        f"{len(produits)} produits ({detail}), dont {surs} sûrs d'être chez Leclerc ; {avec_photo} avec photo, "
        f"{avec_prix} avec un prix habituel connu."
    )
    print(phrase)
    if resume := os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(resume).open("a", encoding="utf-8") as f:
            f.write(f"## Produits Leclerc\n\n{phrase}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
