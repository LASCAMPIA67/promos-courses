import jsonschema
import pytest

from robot_promos.config import MAGASINS
from robot_promos.offres import creer_offre, dedoublonner, verifier


def offre(**champs):
    base = {
        "id": "leclerc-1",
        "source": "leclerc",
        "magasin": "leclerc-geispolsheim",
        "catalogue": "c",
        "produit": "Banane",
        "prix": 0.95,
    }
    return creer_offre(**(base | champs))


def test_creer_offre_calcule_la_reduction_et_nettoie():
    o = offre(ancien_prix="1,45", produit="  Banane® ", reduction=None)
    assert o["produit"] == "Banane"
    assert o["reduction"] == "-34 %"


def test_creer_offre_ignore_un_ancien_prix_incoherent():
    assert offre(ancien_prix=0.50)["ancien_prix"] is None


def test_creer_offre_unite_sans_prix_unitaire_est_ignoree():
    o = offre(unite="kg")
    assert o["unite"] is None
    assert o["prix_unitaire"] is None


def test_creer_offre_normalise_le_pourcentage():
    assert offre(reduction="-34%")["reduction"] == "-34 %"


def test_dedoublonner_garde_la_plus_complete_et_des_id_uniques():
    courte = offre(id="a")
    longue = offre(id="a", description="Le kilo Catégorie 1")
    autre = offre(id="a", produit="Avocat", prix=0.65)
    resultat = dedoublonner([courte, longue, autre])
    assert len(resultat) == 2
    assert any(o["description"] == "Le kilo Catégorie 1" for o in resultat)
    assert len({o["id"] for o in resultat}) == 2


def test_dedoublonner_reconnait_le_code_barres_meme_avec_une_autre_marque():
    # La même promo dans deux catalogues, la marque écrite différemment.
    sirop = {"produit": "SIROP PÊCHE ZÉRO", "ean": "3092718638016", "prix": 2.75, "date_fin": "2026-10-31"}
    un = offre(id="a", catalogue="26G124E", marque="FRUIT SHOOT", **sirop)
    deux = offre(id="b", catalogue="26G124G", marque="TEISSEIRE", description="60 cl. Existe aussi", **sirop)
    assert [o["id"] for o in dedoublonner([un, deux])] == ["b"]
    # Sans code-barres, deux marques différentes restent deux promos.
    assert len(dedoublonner([offre(id="c", marque="A"), offre(id="d", marque="B")])) == 2
    # Même code-barres mais autre prix : deux promos différentes.
    assert len(dedoublonner([un, offre(id="e", **(sirop | {"prix": 2.10}))])) == 2


def document(offres):
    return {
        "format": 2,
        "mise_a_jour": "2026-10-26T06:00:00+01:00",
        "version_robot": "0.2.0",
        "magasins": MAGASINS,
        "sources": [],
        "offres": offres,
    }


def test_le_schema_accepte_un_document_valide():
    verifier(document([offre(), offre(id="leclerc-2", lot={"quantite": 2, "prix": 1.5, "prix_unitaire": None})]))


def test_le_schema_refuse_un_document_invalide():
    mauvaise = offre() | {"prix": -1}
    with pytest.raises(jsonschema.ValidationError):
        verifier(document([mauvaise]))
    with pytest.raises(jsonschema.ValidationError):
        verifier(document([offre() | {"champ_inconnu": 1}]))
