from robot_promos.sources import Catalogue
from robot_promos.sources.lidl import convertir, dates_de_la_page
from robot_promos.sources.lidl_pdf import ProduitBrut

CATALOGUE = Catalogue(
    id="du-22-10-au-28-10-les-promos-de-la-semaine",
    nom="Les promos de la semaine",
    debut="2026-10-22",
    fin="2026-10-28",
    version="v1",
    lien="https://www.lidl.fr/l/catalogue",
    donnees={"images": {3: "https://image/page-3.jpg"}},
)


def caracteres(texte, x0, top, taille):
    return [{"text": c, "x0": x0 + i * taille * 0.5, "top": top, "size": taille} for i, c in enumerate(texte)]


def test_offre_lidl_plus():
    brut = ProduitBrut(
        nom="Pomme de terre four",
        description="Le filet de 2 kg (1 kg = 0,85 €) avec Lidl Plus au lieu de 2,57 € (1 kg = 1,29 €)",
        code="83274",
        prix=1.69,
        ancien_prix=2.57,
        badge="-34%",
        lidl_plus=True,
        page=3,
    )
    o = convertir(brut, CATALOGUE, "2026-10-22", "2026-10-25")
    assert (o["prix"], o["ancien_prix"], o["reduction"]) == (1.69, 2.57, "-34 % avec Lidl Plus")
    assert (o["prix_unitaire"], o["unite"], o["carte_fidelite"]) == (0.85, "kg", True)
    assert (o["date_debut"], o["date_fin"], o["page"]) == ("2026-10-22", "2026-10-25", 3)
    assert o["image"] == "https://image/page-3.jpg"
    assert o["id"] == "lidl-2026-10-22-83274"


def test_offre_deuxieme_produit_reduit():
    brut = ProduitBrut(
        nom="SAINT ALBY Cervelas",
        description="Le produit de 400 g : 2,65 € (1 kg = 6,63 €) Les 2 produits : 4,24 € (1 kg = 5,30 €)",
        code=None,
        prix=1.59,
        badge="-40%",
    )
    o = convertir(brut, CATALOGUE, "2026-10-22", "2026-10-28")
    assert (o["marque"], o["produit"]) == ("SAINT ALBY", "Cervelas")
    assert o["prix"] == 2.65 and o["ancien_prix"] is None
    assert o["reduction"] == "-40 % sur le 2e"
    assert o["lot"] == {"quantite": 2, "prix": 4.24, "prix_unitaire": 5.30}


def test_offre_produit_offert():
    brut = ProduitBrut(
        nom="CIEN Gel douche",
        description="Le produit de 1 L : 1,99 € Les 3 produits dont 1 OFFERT : 3,98 € (1 L = 1,33 €)",
        code="203767",
        prix=1.33,
        badge="2+1",
    )
    o = convertir(brut, CATALOGUE, "2026-10-22", "2026-10-28")
    assert o["reduction"] == "2 + 1 offert"
    assert o["prix"] == 1.99
    assert o["lot"]["quantite"] == 3 and o["lot"]["prix"] == 3.98


def test_prix_au_kilo_quand_le_prix_est_au_kilo():
    brut = ProduitBrut(nom="Banane", description="Le kilo Catégorie 1", code="80000", prix=0.95)
    o = convertir(brut, CATALOGUE, "2026-10-22", "2026-10-28")
    assert (o["prix_unitaire"], o["unite"]) == (0.95, "kg")


def test_variante_ajoutee_au_nom():
    brut = ProduitBrut(nom="SILVERCREST Poêle", description="", code="1", prix=7.99, variante="Ø 20 cm")
    assert convertir(brut, CATALOGUE, None, None)["produit"] == "Poêle (Ø 20 cm)"


def test_dates_de_la_page():
    assert dates_de_la_page(caracteres("Lundi 26/10", 188, 13.8, 17), CATALOGUE) == ("2026-10-26", "2026-10-28")
    assert dates_de_la_page(caracteres("Du jeudi 22/10 au 28/10", 140, 13.8, 17), CATALOGUE) == (
        "2026-10-22",
        "2026-10-28",
    )
    chars = caracteres("Jeudi 22/10", 188, 13.8, 17) + caracteres("Du jeudi au dimanche", 14, 755, 10)
    assert dates_de_la_page(chars, CATALOGUE) == ("2026-10-22", "2026-10-25")
    assert dates_de_la_page([], CATALOGUE) == ("2026-10-22", "2026-10-28")
