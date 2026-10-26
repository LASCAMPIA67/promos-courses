"""Dessine les icônes de l'appli (panier + étiquette « % ») dans app/public/icones/.

Usage : python app/outils/generer_icones.py   (nécessite Pillow : pip install pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw

DOSSIER = Path(__file__).resolve().parent.parent / "public" / "icones"
TAILLE = 1024  # dessin en grand, puis réduction (bords plus nets)
VERT_HAUT, VERT_BAS = (38, 166, 92), (20, 104, 56)
BLANC, JAUNE, ENCRE = (255, 255, 255), (255, 200, 61), (36, 41, 37)


def fond_degrade(taille):
    image = Image.new("RGB", (taille, taille))
    dessin = ImageDraw.Draw(image)
    for y in range(taille):
        t = y / (taille - 1)
        couleur = tuple(round(h + (b - h) * t) for h, b in zip(VERT_HAUT, VERT_BAS, strict=True))
        dessin.line([(0, y), (taille, y)], fill=couleur)
    return image


def dessiner(echelle=1.0):
    """Panier et étiquette, centrés ; `echelle` < 1 laisse une marge (icône « masquable »)."""
    image = fond_degrade(TAILLE)
    d = ImageDraw.Draw(image)

    def p(x, y):  # coordonnées sur une grille de 1000, centrées et mises à l'échelle
        c = TAILLE / 2
        return (c + (x - 500) * echelle * TAILLE / 1000, c + (y - 500) * echelle * TAILLE / 1000)

    def epaisseur(e):
        return max(1, round(e * echelle * TAILLE / 1000))

    # Anse du panier
    x0, y0 = p(300, 230)
    x1, y1 = p(700, 630)
    d.arc([x0, y0, x1, y1], start=180, end=360, fill=BLANC, width=epaisseur(62))
    # Corps du panier (trapèze) et bord supérieur
    d.polygon([p(205, 430), p(795, 430), p(720, 790), p(280, 790)], fill=BLANC)
    d.rounded_rectangle([p(170, 395), p(830, 470)], radius=epaisseur(30), fill=BLANC)
    # Fentes du panier
    for x in (380, 500, 620):
        d.line([p(x, 525), p(x - (x - 500) * 0.12, 715)], fill=VERT_BAS, width=epaisseur(42))
    # Étiquette « % » en haut à droite
    cx, cy = p(745, 255)
    r = 150 * echelle * TAILLE / 1000
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=JAUNE)
    petit = 30 * echelle * TAILLE / 1000
    for dx, dy in ((-52, -52), (52, 52)):
        ox, oy = cx + dx * echelle * TAILLE / 1000, cy + dy * echelle * TAILLE / 1000
        d.ellipse([ox - petit, oy - petit, ox + petit, oy + petit], outline=ENCRE, width=epaisseur(20))
    d.line([p(745 + 72, 255 - 72), p(745 - 72, 255 + 72)], fill=ENCRE, width=epaisseur(24))
    return image


def enregistrer(image, nom, taille):
    image.resize((taille, taille), Image.LANCZOS).save(DOSSIER / nom, optimize=True)


def main():
    DOSSIER.mkdir(parents=True, exist_ok=True)
    normale = dessiner(0.9)
    for nom, taille in (
        ("icone-512.png", 512),
        ("icone-192.png", 192),
        ("apple-touch-icon.png", 180),
        ("favicon-32.png", 32),
    ):
        enregistrer(normale, nom, taille)
    # Icône « masquable » : Android et iOS peuvent la rogner en cercle, on garde une marge.
    enregistrer(dessiner(0.72), "icone-masquable-512.png", 512)
    print(f"Icônes écrites dans {DOSSIER}")


if __name__ == "__main__":
    main()
