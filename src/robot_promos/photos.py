"""Les photos des produits, en petit, pour l'appli.

Les photos du catalogue Leclerc pèsent souvent 2 à 6 Mo : bien trop pour un téléphone. Le robot
télécharge une seule fois chaque photo fiable (voir sources/leclerc.py, photo_fiable) et en fait une
vignette JPEG carrée de 256 pixels (une quinzaine de Ko), sur fond blanc, le produit centré.

Les vignettes sont rangées dans la branche « photos » du dépôt, réécrite à chaque passage : elle ne
garde que les photos des promos en cours, sans historique (le dépôt ne grossit pas). L'appli les lit
sur raw.githubusercontent.com. Décision d'Emilio du 28/10/2026, voir docs/sources.md.

Lancement, après le robot : python -m robot_promos.photos DOSSIER   (options : --help)
"""

import argparse
import io
import json
import os
import re
import sys
import time
from pathlib import Path

from PIL import Image, ImageChops, ImageOps

from robot_promos.avancee import Avancee, sans_nouvelles
from robot_promos.config import ADRESSE_PHOTOS
from robot_promos.offres import verifier
from robot_promos.web import Navigateur

TAILLE = 256  # côté de la vignette, en pixels : net pour une photo de 80 points sur l'iPhone
MARGE = 12  # blanc autour du produit, en pixels
TAILLE_MAX = 20_000_000  # une photo plus lourde est ignorée (les plus grosses font environ 6 Mo)

# Une image de plus de 40 millions de pixels est refusée (protection contre les images piégées).
Image.MAX_IMAGE_PIXELS = 40_000_000


def nom_photo(adresse):
    """« …/media/a36742fdec095062bc70d90a1edd4f3c » -> « a36742fdec095062bc70d90a1edd4f3c.jpg » (ou None)."""
    identifiant = (adresse or "").rstrip("/").rsplit("/", 1)[-1]
    return f"{identifiant}.jpg" if re.fullmatch(r"[0-9a-f]{16,64}", identifiant) else None


def reduire(octets):
    """La vignette JPEG d'une photo : carrée, fond blanc, le produit centré et sans les bords vides."""
    with Image.open(io.BytesIO(octets)) as originale:
        image = ImageOps.exif_transpose(originale).convert("RGBA")
    blanc = Image.new("RGB", image.size, "white")
    blanc.paste(image, mask=image.getchannel("A"))
    # Le produit seul : on retire le blanc (ou le transparent) tout autour.
    contenu = ImageChops.difference(blanc, Image.new("RGB", image.size, "white")).convert("L")
    cadre = contenu.point(lambda v: 255 if v > 12 else 0).getbbox()
    produit = blanc.crop(cadre) if cadre else blanc
    produit.thumbnail((TAILLE - 2 * MARGE, TAILLE - 2 * MARGE), Image.Resampling.LANCZOS)
    vignette = Image.new("RGB", (TAILLE, TAILLE), "white")
    vignette.paste(produit, ((TAILLE - produit.width) // 2, (TAILLE - produit.height) // 2))
    sortie = io.BytesIO()
    vignette.save(sortie, "JPEG", quality=82, optimize=True, progressive=True)
    return sortie.getvalue()


def nombre(n):
    """1450 -> « 1 450 »."""
    return f"{n:,}".replace(",", "\u202f")


def preparer_photos(nav, offres, dossier, budget=None, horloge=time.monotonic, avancee=sans_nouvelles):
    """Fait les vignettes qui manquent dans `dossier`, retire celles qui ne servent plus et indique
    dans chaque offre l'adresse de sa vignette (« photo »), ou None.

    `budget` : temps maximal de téléchargement, en secondes ; les photos restantes seront faites au
    prochain passage. `avancee` reçoit où on en est (voir avancee.py). Renvoie un petit bilan.
    """
    dossier = Path(dossier)
    dossier.mkdir(parents=True, exist_ok=True)
    a_faire = {}
    for offre in offres:
        nom = nom_photo(offre.get("image"))
        if nom:
            a_faire.setdefault(nom, offre["image"])

    presentes = {fichier.name for fichier in dossier.glob("*.jpg")}
    debut = horloge()
    bilan = {"nouvelles": 0, "en_attente": 0, "erreurs": 0, "retirees": 0}
    pretes = len(presentes & a_faire.keys())
    for nom, adresse in a_faire.items():
        if nom in presentes:
            continue
        nouvelles = f" ({nombre(bilan['nouvelles'])} nouvelles)" if bilan["nouvelles"] else ""
        avancee(f"Photos : {nombre(pretes)} sur {nombre(len(a_faire))}{nouvelles}")
        if budget is not None and horloge() - debut > budget:
            bilan["en_attente"] += 1
            continue
        try:
            reponse = nav.get(adresse, timeout=60)
            if len(reponse.content) > TAILLE_MAX:
                raise ValueError(f"photo trop lourde ({len(reponse.content)} octets)")
            (dossier / nom).write_bytes(reduire(reponse.content))
        except Exception as erreur:  # noqa: BLE001 — une photo illisible ne doit pas arrêter le robot
            print(f"   Photo ignorée ({adresse}) : {type(erreur).__name__} : {erreur}"[:300], flush=True)
            bilan["erreurs"] += 1
            continue
        presentes.add(nom)
        bilan["nouvelles"] += 1
        pretes += 1

    for fichier in dossier.glob("*.jpg"):
        if fichier.name not in a_faire:
            fichier.unlink()
            presentes.discard(fichier.name)
            bilan["retirees"] += 1

    for offre in offres:
        nom = nom_photo(offre.get("image"))
        offre["photo"] = f"{ADRESSE_PHOTOS}{nom}" if nom in presentes else None
    bilan["avec_photo"] = sum(1 for offre in offres if offre["photo"])
    return bilan


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m robot_promos.photos", description=__doc__.splitlines()[0])
    parser.add_argument("dossier", help="dossier des vignettes (la branche « photos »)")
    parser.add_argument("--promos", default="promos.json", help="fichier des promos (par défaut : promos.json)")
    parser.add_argument("--minutes", type=float, default=60, help="temps maximal de téléchargement (par défaut : 60)")
    args = parser.parse_args(argv)

    chemin = Path(args.promos)
    document = json.loads(chemin.read_text(encoding="utf-8"))
    avancee = Avancee()
    print("→ Photos des produits…", flush=True)
    bilan = preparer_photos(Navigateur(), document["offres"], args.dossier, budget=args.minutes * 60, avancee=avancee)
    verifier(document)
    chemin.write_text(json.dumps(document, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    phrase = (
        f"{nombre(bilan['avec_photo'])} promos sur {nombre(len(document['offres']))} avec photo ; "
        f"{bilan['nouvelles']} nouvelles, {bilan['retirees']} retirées, {bilan['erreurs']} illisibles, "
        f"{bilan['en_attente']} pour le prochain passage."
    )
    print(f"   {phrase}", flush=True)
    avancee(f"Photos : {nombre(bilan['avec_photo'])} promos avec photo", forcer=True)
    if resume := os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(resume).open("a", encoding="utf-8") as f:
            f.write(f"\n### Photos\n\n{phrase}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
