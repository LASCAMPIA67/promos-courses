"""La base des produits Leclerc, pour trouver un produit même sans promo : nom, marque, contenance, photo.

Source : Open Food Facts (https://fr.openfoodfacts.org), la base libre des produits alimentaires et
d'hygiène (données sous licence ODbL, photos sous licence CC BY-SA). Son fichier complet est publié
chaque jour (https://static.openfoodfacts.org/data/, permis par son robots.txt) : le robot le lit une
fois par semaine, au fil du téléchargement, sans le garder. Il ne retient que les produits vendus en
France, avec leur nom, en deux groupes :

- ceux dont on est sûr qu'ils sont chez Leclerc : Marque Repère (code-barres 356470…), ceux
  qu'Open Food Facts dit vendus chez Leclerc, et ceux déjà vus dans un catalogue Leclerc
  (historique.json, avec leur dernier prix habituel connu) ;
- les produits courants (scannés par plusieurs personnes), avec une photo, sauf les marques
  propres des autres enseignes (Carrefour, U, Auchan, Lidl…), qu'on ne trouve pas chez Leclerc.

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

from robot_promos.historique import lire as lire_historique
from robot_promos.marques import PREFIXE_MARQUE_REPERE, est_marque_repere
from robot_promos.outils import maintenant, nettoyer
from robot_promos.web import Navigateur

FORMAT = 1  # version du format de produits.json (voir docs/format-promos.md)
SOURCE = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz"
PHOTOS = "https://images.openfoodfacts.org/images/products/"
LICENCE = "Open Food Facts (https://fr.openfoodfacts.org) : données sous licence ODbL, photos sous licence CC BY-SA."

COLONNES = ["ean", "nom", "marque", "quantite", "photo", "leclerc", "prix_habituel", "prix_vu_le"]
MARQUE_REPERE, CHEZ_LECLERC, EN_FRANCE = 2, 1, 0  # colonne « leclerc » : ce qu'on sait du produit
SCANS = 3  # un produit courant : scanné par au moins 3 personnes dans Open Food Facts

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

csv.field_size_limit(2**31 - 1)  # certaines lignes ont des champs très longs


def lignes_open_food_facts(source, nav=None):
    """Les produits du fichier Open Food Facts (adresse ou fichier .csv.gz), un dictionnaire par produit."""
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


def fichier_photo(ean, adresse):
    """« …/356/470/000/0229/front_fr.9.200.jpg » -> « front_fr.9 » (l'appli refait le reste), ou None."""
    dossier = f"{ean[:3]}/{ean[3:6]}/{ean[6:9]}/{ean[9:]}" if len(ean) == 13 else ean
    trouve = re.fullmatch(re.escape(f"{PHOTOS}{dossier}/") + r"([a-z_]+\.\d+)\.200\.jpg", adresse or "")
    return trouve.group(1) if trouve else None


def nombre_de_scans(ligne):
    try:
        return int(float(ligne.get("unique_scans_n") or 0))
    except ValueError:
        return 0


def choisir(lignes, historique, scans=SCANS):
    """Les produits pour produits.json : ceux qu'on sait chez Leclerc d'abord, puis les plus scannés.
    Chaque produit : [ean, nom, marque, quantité, photo, leclerc, prix habituel, prix vu le] (COLONNES)."""
    vus = historique["produits"]
    prix = prix_connus(historique)
    produits = {}
    for ligne in lignes:
        ean = (ligne.get("code") or "").strip()
        if not ean.isdigit() or "en:france" not in (ligne.get("countries_tags") or ""):
            continue
        nom = nettoyer(ligne.get("product_name_fr") or ligne.get("product_name"), longueur_max=120)
        if not nom or autre_enseigne(ean, ligne.get("brands")):
            continue
        photo = fichier_photo(ean, ligne.get("image_small_url"))
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
        produits[ean] = ([ean, nom, marque, quantite, photo, leclerc], nombre_de_scans(ligne))
    # Les produits vus dans un catalogue Leclerc qu'Open Food Facts ne connaît pas : sans photo.
    for ean, produit in vus.items():
        if ean not in produits and produit.get("produit"):
            produits[ean] = ([ean, produit["produit"], produit.get("marque"), None, None, CHEZ_LECLERC], 0)
    for ean, (ligne, _) in produits.items():
        if ligne[5] == CHEZ_LECLERC and est_marque_repere({"ean": ean, "marque": ligne[2]}):
            ligne[5] = MARQUE_REPERE  # une gamme Marque Repère à un autre code-barres (Tradilège)
        ligne.extend(prix.get(ean, (None, None)))
    rang = sorted(produits.values(), key=lambda p: (-p[0][5], -p[1], p[0][0]))
    return [ligne for ligne, _ in rang]


def ecrire(chemin, produits):
    """Un produit par ligne : le fichier reste lisible, et ses changements d'une semaine à l'autre, petits."""
    entete = {"format": FORMAT, "mise_a_jour": maintenant(), "source": LICENCE, "photos": PHOTOS, "colonnes": COLONNES}
    debut = json.dumps(entete, ensure_ascii=False, indent=1)[:-2]
    lignes = ",\n".join(json.dumps(p, ensure_ascii=False, separators=(",", ":")) for p in produits)
    Path(chemin).write_text(f'{debut},\n "produits": [\n{lignes}\n ]\n}}\n', encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m robot_promos.produits", description=__doc__.splitlines()[0])
    parser.add_argument("--source", default=SOURCE, help="fichier Open Food Facts (adresse ou .csv.gz)")
    parser.add_argument(
        "--historique", default="historique.json", help="historique des prix (par défaut : historique.json)"
    )
    parser.add_argument("--sortie", default="produits.json", help="fichier à écrire (par défaut : produits.json)")
    parser.add_argument(
        "--scans", type=int, default=SCANS, help=f"scans pour un produit courant (par défaut : {SCANS})"
    )
    args = parser.parse_args(argv)

    produits = choisir(lignes_open_food_facts(args.source), lire_historique(args.historique), args.scans)
    if not produits:
        print("Aucun produit trouvé : produits.json n'est pas modifié.")
        return 1
    ecrire(args.sortie, produits)
    surs = sum(1 for p in produits if p[5] != EN_FRANCE)
    avec_photo = sum(1 for p in produits if p[4])
    avec_prix = sum(1 for p in produits if p[6])
    phrase = (
        f"{len(produits)} produits, dont {surs} sûrs d'être chez Leclerc ; {avec_photo} avec photo, "
        f"{avec_prix} avec un prix habituel connu."
    )
    print(phrase)
    if resume := os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(resume).open("a", encoding="utf-8") as f:
            f.write(f"## Produits Leclerc\n\n{phrase}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
