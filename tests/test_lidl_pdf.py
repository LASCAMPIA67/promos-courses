from robot_promos.sources.lidl_pdf import (
    analyser_description,
    extraire,
    pied_de_page,
    separer_marque,
    titre_de_page,
)

NOM, DESC, CODE, PRIX, BADGE = (
    "ABCDEF+LidlFontCondPro-Bold",
    "ABCDEF+LidlFontCondPro-Book",
    "ABCDEF+LidlFontPro-Regular",
    "ABCDEF+LidlFontPrice-Pt",
    "ABCDEF+LidlFontPro-Bold",
)
TAILLES = {NOM: 10, DESC: 8, CODE: 4, PRIX: 50, BADGE: 20}


def ligne(texte, x0, top, police, taille=None):
    """Fabrique les mots d'une ligne de texte, comme pdfplumber."""
    taille = taille or TAILLES[police]
    chasse = 0.3 if police == PRIX else 0.5  # les chiffres des prix sont étroits
    mots = []
    for morceau in texte.split():
        largeur = len(morceau) * taille * chasse
        mots.append(
            {
                "text": morceau,
                "x0": x0,
                "x1": x0 + largeur,
                "top": top,
                "bottom": top + taille,
                "size": taille,
                "fontname": police,
            }
        )
        x0 += largeur + taille * 0.3
    return mots


def produit_banane(x=14, y=683):
    return (
        ligne("Banane", x, y, NOM)
        + ligne("Le kilo", x, y + 11.7, DESC)
        + ligne("Catégorie 1", x, y + 20.7, DESC)
        + ligne("n o 80000", x, y + 30, CODE)
        + ligne("0.95", x + 133, y + 11.8, PRIX)
        + ligne("1.45", x + 200, y + 17.2, DESC, 10)
        + ligne("-34%", x + 136, y - 6.8, BADGE)
    )


def test_extraire_un_produit_complet():
    carre_bleu = {"x0": 196, "x1": 225, "top": 666, "bottom": 696, "couleur": (0.0, 0.327, 0.609)}
    (p,) = extraire(produit_banane(), [carre_bleu], page=2)
    assert (p.nom, p.description, p.code, p.prix) == ("Banane", "Le kilo Catégorie 1", "80000", 0.95)
    assert (p.ancien_prix, p.badge, p.lidl_plus, p.page) == (1.45, "-34%", True, 2)
    assert not p.en_ligne_seulement


def test_sans_carre_bleu_pas_de_lidl_plus():
    (p,) = extraire(produit_banane(), [])
    assert p.lidl_plus is False


def test_chaque_prix_va_avec_son_produit():
    mots = produit_banane(x=14) + ligne("Avocat", 240, 701, NOM) + ligne("La pièce", 240, 712.8, DESC)
    mots += ligne("0.65", 361, 694.8, PRIX)
    produits = {p.nom: p.prix for p in extraire(mots, [])}
    assert produits == {"Banane": 0.95, "Avocat": 0.65}


def test_prix_sous_le_produit_et_produit_en_ligne():
    mots = (
        ligne("Uniquement en ligne", 20, 280, DESC, 5)
        + ligne("PARKSIDE", 20, 295, NOM)
        + ligne("Chariot de mécanicien", 20, 305, NOM)
        + ligne("L'unité.", 20, 316, DESC)
        + ligne("19.99", 20, 345, PRIX)
    )
    (p,) = extraire(mots, [])
    assert p.nom == "PARKSIDE Chariot de mécanicien" and p.prix == 19.99
    assert p.en_ligne_seulement


def test_prix_en_morceaux_et_exposants():
    mots = ligne("Gouda", 10, 100, NOM) + ligne("1 kg", 10, 112, DESC)
    mots += [
        {"text": "12", "x0": 80, "x1": 120, "top": 110, "bottom": 160, "size": 50, "fontname": PRIX},
        {"text": ".⁹⁹", "x0": 122, "x1": 150, "top": 110, "bottom": 160, "size": 50, "fontname": PRIX},
    ]
    (p,) = extraire(mots, [])
    assert p.prix == 12.99


def test_analyser_description_lidl_plus():
    infos = analyser_description("600 g (1 kg = 7,08 €) avec Lidl Plus au lieu de 5,29 € (1 kg = 8,82 €)")
    assert infos["lidl_plus"] and infos["au_lieu_de"] == 5.29
    assert (infos["prix_unitaire"], infos["unite"]) == (7.08, "kg")


def test_analyser_description_deuxieme_produit():
    infos = analyser_description("Le produit de 400 g : 2,65 € (1 kg = 6,63 €) Les 2 produits : 4,24 € (1 kg = 5,30 €)")
    assert infos["prix_normal"] == 2.65
    assert (infos["lot_quantite"], infos["lot_offerts"], infos["lot_prix"]) == (2, 0, 4.24)
    assert infos["lot_prix_unitaire"] == 5.30 and infos["prix_unitaire"] == 6.63


def test_analyser_description_produit_offert():
    infos = analyser_description("Le produit de 75 cl : 3,99 € (1 L = 5,32 €) Les 3 produits dont 1 OFFERT : 7,98 €")
    assert (infos["lot_quantite"], infos["lot_offerts"], infos["lot_prix"]) == (3, 1, 7.98)
    assert infos["unite"] == "l"


def test_analyser_description_prix_au_kilo_implicite():
    assert analyser_description("Le kilo Catégorie 1")["par_kilo"]
    assert analyser_description("Le filet de 1 kg Catégorie 1")["unite"] == "kg"
    assert analyser_description("La pièce Catégorie 1")["unite"] == "pièce"
    assert "unite" not in analyser_description("La pièce d'environ 1,5 et 2,4 kg")
    assert "unite" not in analyser_description("Le sachet de 0,1 kg")


def test_separer_marque():
    assert separer_marque("SILVERCREST Machine à pâtes") == ("SILVERCREST", "Machine à pâtes")
    assert separer_marque("L’ÉTAL DU BOUCHER 8 saucisses") == ("L’ÉTAL DU BOUCHER", "8 saucisses")
    assert separer_marque("2 filets de limande MSC") == (None, "2 filets de limande MSC")
    assert separer_marque("CAPRICE DES DIEUX") == (None, "CAPRICE DES DIEUX")
    assert separer_marque("À la carte") == (None, "À la carte")


def caracteres(texte, x0, top, taille):
    return [{"text": c, "x0": x0 + i * taille * 0.5, "top": top, "size": taille} for i, c in enumerate(texte)]


def test_titre_de_page_garde_le_bandeau_visible():
    # Deux bandeaux superposés : le dernier dessiné est celui qu'on voit.
    chars = caracteres("Jeudi 22/10", 188, 13.8, 17) + caracteres("Lundi 26/10", 188, 13.8, 17)
    assert titre_de_page(chars) == "Lundi 26/10"
    assert titre_de_page(caracteres("Bienvenue", 188, 13.8, 17)) is None


def test_pied_de_page():
    assert pied_de_page(caracteres("Du jeudi au dimanche", 14, 755, 10)) == ("jeudi", "dimanche")
    assert pied_de_page(caracteres("Plus d'informations", 14, 765, 9)) is None
