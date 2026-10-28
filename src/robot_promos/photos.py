"""Les photos des produits et les logos des marques, en petit, pour l'appli.

Les photos du catalogue Leclerc pèsent souvent 2 à 6 Mo : bien trop pour un téléphone. Le robot
télécharge une seule fois chaque photo fiable (voir sources/leclerc.py, photo_fiable) et en fait une
vignette JPEG carrée de 256 pixels (une quinzaine de Ko), sur fond blanc, le produit centré. De même
pour le logo de chaque marque (sources/leclerc.py, logo_de_la_marque ; sinon le logo officiel pris
sur Wikipédia, voir marques.py) : une petite image PNG, dans « logos/ », qui sert à toutes les promos
de la marque. Les produits Marque Repère ont tous le logo Marque Repère.

Les vignettes sont rangées dans la branche « photos » du dépôt, réécrite à chaque passage : elle ne
garde que les photos des promos en cours, sans historique (le dépôt ne grossit pas). L'appli les lit
sur raw.githubusercontent.com. Décision d'Emilio du 28/10/2026, voir docs/sources.md.

Lancement, après le robot : python -m robot_promos.photos DOSSIER   (options : --help)
"""

import argparse
import hashlib
import io
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageChops, ImageOps

from robot_promos.avancee import Avancee, sans_nouvelles
from robot_promos.config import ADRESSE_PHOTOS
from robot_promos.marques import (
    MARQUE_REPERE,
    SOUS_MARQUES,
    cle_marque,
    est_marque_repere,
    logos_a_verifier,
    logos_officiels,
)
from robot_promos.offres import verifier
from robot_promos.web import Navigateur

TAILLE = 256  # côté de la vignette, en pixels : net pour une photo de 80 points sur l'iPhone
MARGE = 12  # blanc autour du produit, en pixels
TAILLE_MAX = 20_000_000  # une photo plus lourde est ignorée (les plus grosses font environ 6 Mo)
LOGO = (300, 96)  # largeur et hauteur maximales d'un logo, en pixels : net en 24 points de haut

# Une image de plus de 40 millions de pixels est refusée (protection contre les images piégées).
Image.MAX_IMAGE_PIXELS = 40_000_000


def nom_photo(adresse, extension="jpg"):
    """« …/media/a36742fdec095062bc70d90a1edd4f3c » -> « a36742fdec095062bc70d90a1edd4f3c.jpg » (ou None)."""
    identifiant = (adresse or "").rstrip("/").rsplit("/", 1)[-1]
    return f"{identifiant}.{extension}" if re.fullmatch(r"[0-9a-f]{16,64}", identifiant) else None


def nom_logo(adresse):
    """Le fichier d'un logo : celui du catalogue garde son identifiant ; un logo de Wikipédia prend une
    empreinte de son adresse (« 3f9a…e1.png »)."""
    if not adresse:
        return None
    return nom_photo(adresse, "png") or f"{hashlib.sha256(adresse.encode()).hexdigest()[:32]}.png"


def sur_fond_blanc(octets):
    """L'image sur fond blanc (le transparent devient blanc), sans les bords vides tout autour."""
    with Image.open(io.BytesIO(octets)) as originale:
        image = ImageOps.exif_transpose(originale).convert("RGBA")
    blanc = Image.new("RGB", image.size, "white")
    blanc.paste(image, mask=image.getchannel("A"))
    contenu = ImageChops.difference(blanc, Image.new("RGB", image.size, "white")).convert("L")
    cadre = contenu.point(lambda v: 255 if v > 12 else 0).getbbox()
    return blanc.crop(cadre) if cadre else blanc


def reduire(octets):
    """La vignette JPEG d'une photo : carrée, fond blanc, le produit centré et sans les bords vides."""
    produit = sur_fond_blanc(octets)
    produit.thumbnail((TAILLE - 2 * MARGE, TAILLE - 2 * MARGE), Image.Resampling.LANCZOS)
    vignette = Image.new("RGB", (TAILLE, TAILLE), "white")
    vignette.paste(produit, ((TAILLE - produit.width) // 2, (TAILLE - produit.height) // 2))
    sortie = io.BytesIO()
    vignette.save(sortie, "JPEG", quality=82, optimize=True, progressive=True)
    return sortie.getvalue()


def reduire_logo(octets):
    """La vignette PNG d'un logo : sur fond blanc, sans les bords vides, 300 sur 96 pixels au plus."""
    logo = sur_fond_blanc(octets)
    logo.thumbnail(LOGO, Image.Resampling.LANCZOS)
    sortie = io.BytesIO()
    logo.quantize(colors=64).save(sortie, "PNG", optimize=True)  # 64 couleurs suffisent à un logo
    return sortie.getvalue()


def nombre(n):
    """1450 -> « 1 450 »."""
    return f"{n:,}".replace(",", "\u202f")


def faire_vignettes(
    nav, a_faire, dossier, extension, fabriquer, libelle, limite=None, horloge=time.monotonic, avancee=sans_nouvelles
):
    """Fait les vignettes qui manquent dans `dossier` avec `fabriquer` : `a_faire` donne, pour chaque
    fichier (d'extension `extension`), l'adresse de l'original. S'arrête à l'heure `limite` (les autres
    attendront le prochain passage), puis retire celles qui ne servent plus. Renvoie (les fichiers
    présents, un petit bilan)."""
    dossier.mkdir(parents=True, exist_ok=True)
    presentes = {fichier.name for fichier in dossier.glob(f"*.{extension}")}
    bilan = {"nouvelles": 0, "en_attente": 0, "erreurs": 0, "retirees": 0}
    pretes = len(presentes & a_faire.keys())
    for nom, adresse in a_faire.items():
        if nom in presentes:
            continue
        nouvelles = f" ({nombre(bilan['nouvelles'])} nouvelles)" if bilan["nouvelles"] else ""
        avancee(f"{libelle} : {nombre(pretes)} sur {nombre(len(a_faire))}{nouvelles}")
        if limite is not None and horloge() > limite:
            bilan["en_attente"] += 1
            continue
        try:
            reponse = nav.get(adresse, timeout=60)
            if len(reponse.content) > TAILLE_MAX:
                raise ValueError(f"image trop lourde ({len(reponse.content)} octets)")
            (dossier / nom).write_bytes(fabriquer(reponse.content))
        except Exception as erreur:  # noqa: BLE001 — une image illisible ne doit pas arrêter le robot
            print(f"   Image ignorée ({adresse}) : {type(erreur).__name__} : {erreur}"[:300], flush=True)
            bilan["erreurs"] += 1
            continue
        presentes.add(nom)
        bilan["nouvelles"] += 1
        pretes += 1

    for fichier in dossier.glob(f"*.{extension}"):
        if fichier.name not in a_faire:
            fichier.unlink()
            presentes.discard(fichier.name)
            bilan["retirees"] += 1
    return presentes, bilan


def preparer_photos(nav, offres, dossier, budget=None, horloge=time.monotonic, avancee=sans_nouvelles):
    """Fait les vignettes des photos qui manquent dans `dossier`, retire celles qui ne servent plus et
    indique dans chaque offre l'adresse de sa vignette (« photo »), ou None.

    `budget` : temps maximal de téléchargement, en secondes ; les photos restantes seront faites au
    prochain passage. `avancee` reçoit où on en est (voir avancee.py). Renvoie un petit bilan.
    """
    a_faire = {}
    for offre in offres:
        nom = nom_photo(offre.get("image"))
        if nom:
            a_faire.setdefault(nom, offre["image"])
    limite = None if budget is None else horloge() + budget
    presentes, bilan = faire_vignettes(nav, a_faire, Path(dossier), "jpg", reduire, "Photos", limite, horloge, avancee)
    for offre in offres:
        nom = nom_photo(offre.get("image"))
        offre["photo"] = f"{ADRESSE_PHOTOS}{nom}" if nom in presentes else None
    bilan["avec_photo"] = sum(1 for offre in offres if offre["photo"])
    return bilan


def preparer_logos(nav, offres, dossier, budget=None, horloge=time.monotonic, avancee=sans_nouvelles, officiels=None):
    """Fait les vignettes des logos (dans `dossier`/logos) et indique dans chaque offre celui de sa
    marque (« logo »), ou None. Une marque n'a qu'un logo : celui que le catalogue joint le plus
    souvent à ses produits, repris pour tous, même ceux qui n'en ont pas ; sinon son logo officiel
    pris sur Wikipédia (`officiels`, par défaut ceux de logos.json) ; sinon celui de la marque dont
    elle est une gamme (SOUS_MARQUES, dans marques.py). Les produits Marque Repère ont
    tous le logo Marque Repère, et « logo_marque » le dit. Renvoie un petit bilan.
    """
    officiels = logos_officiels() if officiels is None else officiels
    par_marque = defaultdict(Counter)
    for offre in offres:
        if offre.get("marque") and nom_photo(offre.get("logo_catalogue"), "png"):
            par_marque[cle_marque(offre["marque"])][offre["logo_catalogue"]] += 1
    choisis = officiels | {marque: logos.most_common(1)[0][0] for marque, logos in par_marque.items()}
    marque_repere = officiels.get(cle_marque(MARQUE_REPERE))

    def logo_de(offre):
        """(adresse du logo, marque qu'il montre quand ce n'est pas celle du produit)."""
        if not offre.get("marque"):
            return None, None
        if marque_repere and est_marque_repere(offre):
            return marque_repere, MARQUE_REPERE
        marque = cle_marque(offre["marque"])
        return choisis.get(marque) or choisis.get(SOUS_MARQUES.get(marque)), None

    logos = [logo_de(offre) for offre in offres]
    a_faire = {nom_logo(adresse): adresse for adresse, _ in logos if adresse}
    limite = None if budget is None else horloge() + budget
    dossier = Path(dossier) / "logos"
    presentes, bilan = faire_vignettes(nav, a_faire, dossier, "png", reduire_logo, "Logos", limite, horloge, avancee)
    for offre, (adresse, montre) in zip(offres, logos, strict=True):
        offre["logo"] = f"{ADRESSE_PHOTOS}logos/{nom_logo(adresse)}" if nom_logo(adresse) in presentes else None
        offre["logo_marque"] = montre if offre["logo"] else None
    bilan["avec_logo"] = sum(1 for offre in offres if offre["logo"])
    bilan["marque_repere"] = sum(1 for offre in offres if offre["logo_marque"] == MARQUE_REPERE)
    bilan["marques"] = len(presentes & a_faire.keys())
    bilan["sans_logo"] = sorted({cle_marque(o["marque"]) for o in offres if o.get("marque") and not o["logo"]})
    return bilan


def preparer_logos_a_verifier(nav, candidats, dossier):
    """Télécharge, sans les montrer dans l'appli, les logos qui attendent d'être regardés à l'œil
    (`candidats` : marque -> adresses possibles) : dans `dossier`/logos-a-verifier, le premier fichier
    qui existe. Retire ceux qui ne sont plus candidats. Renvoie marque -> nom du fichier, ou None."""
    dossier = Path(dossier) / "logos-a-verifier"
    dossier.mkdir(parents=True, exist_ok=True)
    trouves = {}
    for marque, adresses in candidats.items():
        trouves[marque] = None
        for adresse in adresses:
            nom = nom_logo(adresse)
            if not (dossier / nom).exists():
                try:
                    (dossier / nom).write_bytes(reduire_logo(nav.get(adresse, timeout=60).content))
                except Exception as erreur:  # noqa: BLE001 — l'adresse suivante est peut-être la bonne
                    print(f"   Logo à vérifier introuvable ({adresse}) : {type(erreur).__name__}"[:300], flush=True)
                    continue
            trouves[marque] = nom
            break
    for fichier in dossier.glob("*.png"):
        if fichier.name not in trouves.values():
            fichier.unlink()
    return trouves


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m robot_promos.photos", description=__doc__.splitlines()[0])
    parser.add_argument("dossier", help="dossier des vignettes (la branche « photos »)")
    parser.add_argument("--promos", default="promos.json", help="fichier des promos (par défaut : promos.json)")
    parser.add_argument("--minutes", type=float, default=60, help="temps maximal de téléchargement (par défaut : 60)")
    args = parser.parse_args(argv)

    chemin = Path(args.promos)
    document = json.loads(chemin.read_text(encoding="utf-8"))
    avancee = Avancee()
    nav = Navigateur()
    debut = time.monotonic()
    # Les logos d'abord (peu nombreux, une fois par marque), puis les photos avec le temps qui reste.
    print("→ Logos des marques…", flush=True)
    logos = preparer_logos(nav, document["offres"], args.dossier, budget=args.minutes * 60, avancee=avancee)
    a_verifier = preparer_logos_a_verifier(nav, logos_a_verifier(), args.dossier)
    print("→ Photos des produits…", flush=True)
    reste = max(0, args.minutes * 60 - (time.monotonic() - debut))
    bilan = preparer_photos(nav, document["offres"], args.dossier, budget=reste, avancee=avancee)
    verifier(document)
    chemin.write_text(json.dumps(document, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    phrase = (
        f"{nombre(bilan['avec_photo'])} promos sur {nombre(len(document['offres']))} avec photo ; "
        f"{bilan['nouvelles']} nouvelles, {bilan['retirees']} retirées, {bilan['erreurs']} illisibles, "
        f"{bilan['en_attente']} pour le prochain passage."
    )
    phrase_logos = (
        f"{nombre(logos['avec_logo'])} promos avec le logo de leur marque ({logos['marques']} logos, "
        f"dont {nombre(logos['marque_repere'])} promos Marque Repère) ; "
        f"{logos['nouvelles']} nouveaux, {logos['retirees']} retirés, {logos['erreurs']} illisibles, "
        f"{logos['en_attente']} pour le prochain passage."
    )
    sans_logo = f"Marques sans logo ({len(logos['sans_logo'])}) : {', '.join(logos['sans_logo']) or 'aucune'}."
    attente = ", ".join(f"{marque} : {nom or 'introuvable'}" for marque, nom in a_verifier.items()) or "aucun"
    phrase_attente = f"Logos à vérifier à l'œil (dans logos-a-verifier/, pas montrés dans l'appli) : {attente}."
    print(f"   {phrase_logos}\n   {phrase}", flush=True)
    avancee(f"Photos : {nombre(bilan['avec_photo'])} promos avec photo", forcer=True)
    if resume := os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(resume).open("a", encoding="utf-8") as f:
            f.write(f"\n### Photos et logos\n\n{phrase}\n\n{phrase_logos}\n\n{sans_logo}\n\n{phrase_attente}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
