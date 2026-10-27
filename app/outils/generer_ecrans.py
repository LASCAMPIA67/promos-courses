"""Dessine les écrans de démarrage de l'appli pour l'iPhone (logo au centre, clair et sombre).

L'iPhone les montre pendant que l'appli installée s'ouvre, au lieu d'un écran vide. Il en faut un par
taille d'écran : la liste ci-dessous couvre les iPhone depuis le X et le SE. Les balises qui vont avec
sont dans app/index.html (« apple-touch-startup-image »).

Usage : python app/outils/generer_ecrans.py   (nécessite Pillow : pip install pillow)
"""

from pathlib import Path

from generer_icones import dessiner
from PIL import Image, ImageDraw

DOSSIER = Path(__file__).resolve().parent.parent / "public" / "demarrage"

# Taille de l'écran en points (largeur, hauteur) et densité de pixels, comme dans les balises.
ECRANS = [
    (440, 956, 3),  # 16 Pro Max, 17 Pro Max
    (420, 912, 3),  # Air
    (402, 874, 3),  # 16 Pro, 17, 17 Pro
    (430, 932, 3),  # 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
    (393, 852, 3),  # 14 Pro, 15, 15 Pro, 16
    (428, 926, 3),  # 12 Pro Max, 13 Pro Max, 14 Plus
    (390, 844, 3),  # 12, 13, 14, 16e
    (375, 812, 3),  # X, XS, 11 Pro, 12 mini, 13 mini
    (414, 896, 3),  # XS Max, 11 Pro Max
    (414, 896, 2),  # XR, 11
    (375, 667, 2),  # SE, 8
]

# Les mêmes couleurs de fond que l'appli (--fond dans style.css), en clair et en sombre.
FONDS = {"clair": (245, 246, 241), "sombre": (18, 20, 18)}
TAILLE_LOGO = 96  # en points, comme l'écran de chargement de l'appli (.logo-demarrage)


def logo_arrondi(taille):
    logo = dessiner(0.9).resize((taille, taille), Image.LANCZOS)
    masque = Image.new("L", (taille, taille), 0)
    ImageDraw.Draw(masque).rounded_rectangle([0, 0, taille - 1, taille - 1], radius=round(taille * 0.22), fill=255)
    logo.putalpha(masque)
    return logo


def main():
    DOSSIER.mkdir(parents=True, exist_ok=True)
    for largeur, hauteur, densite in ECRANS:
        logo = logo_arrondi(TAILLE_LOGO * densite)
        for theme, fond in FONDS.items():
            image = Image.new("RGB", (largeur * densite, hauteur * densite), fond)
            position = ((image.width - logo.width) // 2, (image.height - logo.height) // 2)
            image.paste(logo, position, logo)
            image.save(DOSSIER / f"demarrage-{largeur}x{hauteur}@{densite}-{theme}.png", optimize=True)
    print(f"Écrans de démarrage écrits dans {DOSSIER}")


if __name__ == "__main__":
    main()
