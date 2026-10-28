"""Tests de l'historique des prix (aucun accès à internet)."""

import json

from robot_promos.historique import ajouter, comparer, lire, mettre_a_jour, prix_article

EAN = "3564700000017"


def offre(catalogue, du, prix, au=None, lot=None, ean=EAN):
    return {
        "catalogue": catalogue,
        "date_debut": du,
        "date_fin": au or du,
        "prix": prix,
        "lot": lot,
        "ean": ean,
        "produit": "PIZZA FRAÎCHE",
        "marque": "TURINI",
    }


def test_prix_article_le_lot_quand_il_est_moins_cher():
    assert prix_article(offre("A", "2026-10-01", 2.31)) == 2.31
    assert prix_article(offre("A", "2026-10-01", 2.31, lot={"quantite": 2, "prix": 3.70})) == 1.85
    assert prix_article(offre("A", "2026-10-01", None)) is None  # « tous les produits de la marque »
    douteux = offre("A", "2026-10-01", 2.31, lot={"quantite": 2, "prix": 2.31})  # le prix d'un seul
    assert prix_article(douteux) == 2.31
    assert prix_article({**douteux, "reduction": "1 + 1 offert"}) == 1.16


def test_comparer_aux_promos_d_avant():
    historique = lire("/nexiste/pas.json")
    ajouter(
        historique,
        [offre("A", "2026-09-01", 2.50), offre("B", "2026-09-20", 1.99), offre("C", "2026-10-01", 1.99)],
        "2026-10-01",
    )

    assert comparer(historique, offre("D", "2026-10-27", 1.89)) == {
        "verdict": "plus_bas",
        "depuis": "2026-09-01",
        "promos": 3,
        "meilleur_prix": 1.99,
        "meilleur_le": "2026-10-01",  # à prix égal, la dernière
    }
    assert comparer(historique, offre("D", "2026-10-27", 1.99))["verdict"] == "egal"
    assert comparer(historique, offre("D", "2026-10-27", 2.31))["verdict"] == "plus_cher"
    # Seulement les promos d'avant : ni elle-même, ni celles qui commencent après.
    assert comparer(historique, offre("A", "2026-09-01", 2.50)) is None
    assert comparer(historique, offre("B", "2026-09-20", 1.99))["promos"] == 1
    # Un produit jamais vu, ou sans prix : rien à dire.
    assert comparer(historique, offre("D", "2026-10-27", 1.89, ean="1111111111111")) is None
    assert comparer(historique, offre("D", "2026-10-27", None)) is None


def test_ajouter_une_seule_fois_par_promo_et_oublier_apres_deux_ans():
    historique = lire("/nexiste/pas.json")
    for _ in range(3):  # trois passages le même jour
        ajouter(historique, [offre("A", "2026-10-20", 2.31, au="2026-10-31")], "2026-10-28")
    ajouter(historique, [offre("A", "2026-10-20", 2.10, au="2026-11-02")], "2026-10-29")  # la même, corrigée
    assert historique["debut"] == "2026-10-28"
    assert historique["produits"][EAN]["promos"] == [
        {"catalogue": "A", "du": "2026-10-20", "au": "2026-11-02", "prix": 2.10}
    ]
    ajouter(historique, [offre("Z", "2028-12-01", 3.00, ean="2222222222222")], "2028-12-01")
    assert list(historique["produits"]) == ["2222222222222"]  # la promo de 2026 est oubliée


def test_mettre_a_jour_ecrit_un_fichier_json_d_une_ligne_par_produit(tmp_path):
    chemin = tmp_path / "historique.json"
    premier = [offre("A", "2026-10-20", 2.31), offre("A", "2026-10-20", 1.50, ean="3333333333333")]
    assert mettre_a_jour(chemin, premier, "2026-10-28") == 0  # l'historique commence vide
    assert premier[0]["historique"] is None

    suivant = [offre("B", "2026-11-03", 1.99)]
    assert mettre_a_jour(chemin, suivant, "2026-11-03") == 1
    assert suivant[0]["historique"]["verdict"] == "plus_bas"

    texte = chemin.read_text(encoding="utf-8")
    assert len(texte.splitlines()) == 4 + 2 + 2  # en-tête (4 lignes), un produit par ligne, fin (2 lignes)
    lu = json.loads(texte)
    assert lu["format"] == 1
    assert [p["catalogue"] for p in lu["produits"][EAN]["promos"]] == ["A", "B"]
