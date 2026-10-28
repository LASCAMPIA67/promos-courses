"""Tests de la base des produits (aucun accès à internet : de petits fichiers comme ceux d'Open Food Facts)."""

import gzip
import json

from robot_promos import produits
from robot_promos.historique import ajouter, lire
from robot_promos.produits import (
    BASES,
    COLONNES,
    autre_enseigne,
    choisir,
    fichier_photo,
    lignes_open_food_facts,
    marque_principale,
    produits_de_la_base,
    vendu_en_france,
)

PHOTOS = BASES["off"].photos

COLONNES_OFF = [
    "code",
    "product_name",
    "brands",
    "quantity",
    "stores",
    "countries_tags",
    "unique_scans_n",
    "image_small_url",
]


def photo(ean, fichier="front_fr.9", photos=PHOTOS):
    return f"{photos}{ean[:3]}/{ean[3:6]}/{ean[6:9]}/{ean[9:]}/{fichier}.200.jpg"


LIGNES = [
    # Marque Repère (code-barres de Scamark) : gardé, même sans photo ni scan.
    [
        "3564700000229",
        "Brocolis surgelés",
        "Marque Repère, Notre Jardin",
        "1 kg",
        "",
        "en:france",
        "",
        photo("3564700000229"),
    ],
    ["3564700000236", "Choux de Bruxelles", "Marque Repère", "1 kg", "", "en:france", "", ""],
    # Dit vendu chez Leclerc.
    ["7613035000001", "Bouillon de bœuf", "Maggi", "", "E.Leclerc, Carrefour", "en:france", "1", ""],
    # Vu dans un catalogue Leclerc (historique) : gardé, avec son prix habituel.
    [
        "3017620422003",
        "Nutella",
        "Ferrero",
        "750 g",
        "",
        "en:france,en:belgium",
        "40",
        photo("3017620422003", "front_fr.12"),
    ],
    # Un produit courant en France : gardé (scanné 9 fois, avec photo).
    ["7613035000000", "Arôme Maggi", "Maggi", "250 ml", "", "en:france", "9", photo("7613035000000")],
    # Écartés : pas assez courant, sans photo, d'un autre pays, d'une autre enseigne, sans nom.
    ["3033710000001", "Sauce rare", "Maggi", "", "", "en:france", "2", photo("3033710000001")],
    ["3033710000002", "Sauce sans photo", "Maggi", "", "", "en:france", "30", ""],
    ["6111111111111", "Arôme d'ailleurs", "Maggi", "", "", "en:france", "30", photo("6111111111111")],
    ["3560070000000", "Lait demi-écrémé", "Carrefour", "1 l", "Carrefour", "en:france", "50", photo("3560070000000")],
    ["3245000000000", "Yaourt", "Carrefour Bio, Carrefour", "", "E.Leclerc", "en:france", "50", ""],
    ["3564700000999", "Riz", "Marque Repère", "1 kg", "", "en:morocco", "", ""],
    ["3564700000111", "", "Marque Repère", "", "", "en:france", "", ""],
    # Sans pays indiqué : gardé avec un code-barres français, écarté sinon.
    ["3250000000017", "Moutarde forte", "Amora", "", "", "", "5", photo("3250000000017")],
    ["5410000000017", "Moutarde belge", "Amora", "", "", "", "5", photo("5410000000017")],
]

# Open Beauty Facts : ses produits avec une photo, même peu scannés.
OBF = BASES["obf"].photos
LIGNES_BEAUTE = [
    [
        "3600540000004",
        "Shampooing doux",
        "Dop",
        "400 ml",
        "",
        "en:france",
        "0",
        photo("3600540000004", "front_fr.3", OBF),
    ],
    ["3600540000011", "Gel douche", "Dop", "250 ml", "", "en:france", "0", ""],  # sans photo
    # Aussi dans Open Food Facts : sa fiche d'Open Food Facts l'emporte.
    ["7613035000000", "Arôme", "Maggi", "", "", "en:france", "0", photo("7613035000000", "front_fr.1", OBF)],
]


def fichier_open_food_facts(dossier, lignes=LIGNES, nom="off.csv.gz"):
    chemin = dossier / nom
    with gzip.open(chemin, "wt", encoding="utf-8") as f:
        f.write("\t".join(COLONNES_OFF) + "\n")
        for ligne in lignes:
            f.write("\t".join(ligne) + "\n")
    return chemin


def retenus(tmp_path, historique):
    return produits_de_la_base(
        "off", lignes_open_food_facts(str(fichier_open_food_facts(tmp_path))), historique["produits"]
    )


def historique_avec_nutella():
    historique = lire("/nexiste/pas.json")
    nutella = {"ean": "3017620422003", "produit": "NUTELLA", "marque": "FERRERO", "catalogue": "A", "prix": 4.99}
    ajouter(
        historique,
        [{**nutella, "date_debut": "2026-10-20", "date_fin": "2026-10-31", "ancien_prix": 6.25}],
        "2026-10-28",
    )
    bananes = {"ean": "3000000000001", "produit": "BANANES", "marque": None, "catalogue": "A", "prix": 1.29}
    ajouter(historique, [{**bananes, "date_debut": "2026-10-20", "date_fin": "2026-10-31"}], "2026-10-28")
    return historique


def test_marque_principale_et_autres_enseignes():
    assert marque_principale("Marque Repère, Notre Jardin") == "Notre Jardin"
    assert marque_principale("Maggi, Nestlé") == "Maggi"
    assert marque_principale("") is None
    assert autre_enseigne("3017620422003", "Carrefour Bio, Bio")
    assert autre_enseigne("3017620422003", "Pâturages")
    assert autre_enseigne("3560070123456", "")  # le code-barres d'une marque Carrefour
    assert autre_enseigne("3017620422003", "CMI (Carrefour Marchandises Internationales)")
    assert autre_enseigne("3017620422003", "Tesco")
    assert not autre_enseigne("3017620422003", "Ferrero")
    assert not autre_enseigne("3017620422003", "Super U Maggi")  # « U » seul, pas dans un nom


def test_fichier_photo():
    assert fichier_photo("3564700000229", photo("3564700000229")) == "front_fr.9"
    assert fichier_photo("3564700000229", photo("3564700000999")) is None  # la photo d'un autre produit
    assert fichier_photo("3564700000229", "https://ailleurs.exemple/p.jpg") is None
    assert fichier_photo("12345678", f"{PHOTOS}12345678/front_fr.3.200.jpg") == "front_fr.3"
    # Une photo d'une base sœur porte son code ; prise sur un autre site, elle est refusée.
    assert fichier_photo("3600540000004", photo("3600540000004", "front_fr.3", OBF), "obf") == "obf:front_fr.3"
    assert fichier_photo("3600540000004", photo("3600540000004", "front_fr.3"), "obf") is None


def test_vendu_en_france():
    assert vendu_en_france("5410000000017", "en:belgium,en:france")
    assert vendu_en_france("3250000000017", "")  # sans pays : un code-barres français suffit
    assert not vendu_en_france("5410000000017", "")
    assert not vendu_en_france("3250000000017", "en:belgium")


def test_choisir_ceux_de_leclerc_puis_les_plus_courants(tmp_path):
    historique = historique_avec_nutella()
    choisis = choisir([retenus(tmp_path, historique)], historique)
    par_code = {ligne[0]: dict(zip(COLONNES, ligne, strict=True)) for ligne in choisis}
    # Rangés : Marque Repère, puis les autres sûrs d'être chez Leclerc (les plus scannés d'abord), puis les courants.
    assert [ligne[0] for ligne in choisis] == [
        "3564700000229",
        "3564700000236",
        "3017620422003",
        "7613035000001",
        "3000000000001",
        "7613035000000",
        "3250000000017",
    ]
    assert par_code["3564700000229"] == {
        "ean": "3564700000229",
        "nom": "Brocolis surgelés",
        "marque": "Notre Jardin",
        "quantite": "1 kg",
        "photo": "front_fr.9",
        "leclerc": 2,
        "prix_habituel": None,
        "prix_vu_le": None,
    }
    nutella = par_code["3017620422003"]
    assert (nutella["leclerc"], nutella["prix_habituel"], nutella["prix_vu_le"]) == (1, 6.25, "2026-10-20")
    assert par_code["3000000000001"]["nom"] == "BANANES"  # inconnu d'Open Food Facts : le nom du catalogue
    assert par_code["7613035000000"]["leclerc"] == 0  # courant en France, pas sûr d'être chez Leclerc


def test_les_bases_soeurs_ajoutent_leurs_produits_avec_photo(tmp_path):
    historique = historique_avec_nutella()
    beaute = fichier_open_food_facts(tmp_path, LIGNES_BEAUTE, "obf.csv.gz")
    choisis = choisir(
        [retenus(tmp_path, historique), produits_de_la_base("obf", lignes_open_food_facts(str(beaute)), {})],
        historique,
    )
    par_code = {ligne[0]: ligne for ligne in choisis}
    assert par_code["3600540000004"][:6] == ["3600540000004", "Shampooing doux", "Dop", "400 ml", "obf:front_fr.3", 0]
    assert "3600540000011" not in par_code  # sans photo
    assert par_code["7613035000000"][1] == "Arôme Maggi"  # la fiche d'Open Food Facts


def commande(tmp_path, *options):
    chemin_historique = tmp_path / "historique.json"
    chemin_historique.write_text(json.dumps(historique_avec_nutella()), encoding="utf-8")
    sortie = tmp_path / "produits.json"
    resultat = produits.main(
        [
            "--source",
            f"off={fichier_open_food_facts(tmp_path)}",
            *options,
            "--historique",
            str(chemin_historique),
            "--sortie",
            str(sortie),
        ]
    )
    return resultat, sortie


def test_la_commande_ecrit_un_produit_par_ligne(tmp_path, monkeypatch):
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    beaute = fichier_open_food_facts(tmp_path, LIGNES_BEAUTE, "obf.csv.gz")
    resultat, sortie = commande(tmp_path, "--bases", "off,obf", "--source", f"obf={beaute}")
    assert resultat == 0
    texte = sortie.read_text(encoding="utf-8")
    lu = json.loads(texte)
    assert (lu["format"], lu["colonnes"]) == (1, COLONNES)
    assert lu["photos"] == {code: base.photos for code, base in BASES.items()}
    assert "ODbL" in lu["licence"]
    assert lu["sources"] == [
        {"nom": "Open Food Facts", "etat": "ok", "produits": 6},
        {"nom": "Open Beauty Facts", "etat": "ok", "produits": 2},
    ]
    assert len(lu["produits"]) == 8
    assert sum(1 for ligne in texte.splitlines() if ligne.startswith('["')) == 8


def test_une_base_soeur_injoignable_est_notee_sans_open_food_facts_rien_ne_change(tmp_path, monkeypatch):
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    resultat, sortie = commande(tmp_path, "--bases", "off,opf", "--source", f"opf={tmp_path / 'absent.csv.gz'}")
    assert resultat == 0
    lu = json.loads(sortie.read_text(encoding="utf-8"))
    assert lu["sources"][1]["nom"] == "Open Products Facts"
    assert lu["sources"][1]["etat"] == "erreur"
    assert "FileNotFoundError" in lu["sources"][1]["message"]
    assert len(lu["produits"]) == 7

    sortie.unlink()
    resultat, sortie = commande(tmp_path, "--bases", "off", "--source", f"off={tmp_path / 'absent.csv.gz'}")
    assert resultat == 1
    assert not sortie.exists()
