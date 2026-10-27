import pytest

from robot_promos.sources import Catalogue
from robot_promos.sources.leclerc import completer_lot, convertir

CATALOGUE = Catalogue(id="26G124G", nom="Nos promos", debut="2026-10-20", fin="2026-10-31", version="v1", lien="l")


def produit(**champs):
    base = {
        "uid": "abcdef1234567890",
        "name": "PRODUIT",
        "brand": "MARQUE",
        "price": "2.00",
        "discountLabel": "Prix simple",
        "meca": "meca6",
        "unavailability": [],
        "ecatOnly": "false",
        "containerPriceUnit": "Le kg",
        "containerPrice": "8.00",
        "containerPriceBeforeMeca": "8.00",
        "images": [{"url": "https://exemple/image"}],
    }
    return base | champs


def test_prix_simple():
    o = convertir(produit(), CATALOGUE)
    assert (o["prix"], o["ancien_prix"], o["reduction"], o["lot"]) == (2.0, None, None, None)
    assert (o["prix_unitaire"], o["unite"]) == (8.0, "kg")
    assert (o["date_debut"], o["date_fin"]) == ("2026-10-20", "2026-10-31")
    assert o["image"] == "https://exemple/image"
    assert o["id"] == "leclerc-26g124g-abcdef123456"


def test_remise_immediate_en_pourcent():
    o = convertir(
        produit(
            price="3.48",
            priceWithoutDiscount="4.97",
            discountLabel="BRII %",
            discountAmount="30",
            discountUnit="PERCENT",
            containerPrice="18.32",
            containerPriceBeforeMeca="26.16",
        ),
        CATALOGUE,
    )
    assert (o["prix"], o["ancien_prix"], o["reduction"], o["prix_unitaire"]) == (3.48, 4.97, "-30 %", 18.32)


def test_ticket_leclerc_compte_comme_carte_de_fidelite():
    o = convertir(
        produit(
            price="32.29",
            priceWithTEL="22.60",
            discountLabel="TEL %",
            discountAmount="30",
            discountUnit="PERCENT",
            containerPriceUnit="Le L",
            containerPrice="0.00",
            containerPriceBeforeMeca="645.80",
        ),
        CATALOGUE,
    )
    assert o["carte_fidelite"] is True
    assert (o["prix"], o["ancien_prix"]) == (22.6, 32.29)
    assert o["reduction"] == "30 % en Ticket E.Leclerc"
    assert o["prix_unitaire"] == pytest.approx(452.0, abs=0.1)
    assert o["unite"] == "l"


def test_deuxieme_produit_moins_cher():
    o = convertir(
        produit(
            price="3.77",
            discountLabel="-X% sur le Xeme produit",
            discountAmount="60",
            discountUnit="PERCENT",
            discountPriceQty="2",
            discountedPriceLot="5.28",
            containerPrice="11.73",
            containerPriceBeforeMeca="16.76",
        ),
        CATALOGUE,
    )
    assert o["reduction"] == "-60 % sur le 2e"
    assert o["prix"] == 3.77
    assert o["prix_unitaire"] == 16.76
    assert o["lot"] == {"quantite": 2, "prix": 5.28, "prix_unitaire": 11.73}


def test_lots_offerts():
    o = convertir(
        produit(
            price="2.19",
            discountLabel="X+Y OFFERTS",
            discountUnit="EURO",
            offertX="2",
            offertY="1",
            discountedPriceLot="4.38",
            containerPrice="5.07",
            containerPriceBeforeMeca="7.60",
        ),
        CATALOGUE,
    )
    assert o["reduction"] == "2 + 1 offert"
    assert o["lot"] == {"quantite": 3, "prix": 4.38, "prix_unitaire": 5.07}


def test_offre_sur_toute_une_marque():
    o = convertir(
        produit(
            name="SUR LES PRODUITS PRÉSENTS EN MAGASIN DE ",
            brand="BONNE MAMAN",
            price="1.0",
            discountLabel="-X% sur le Xeme produit",
            discountAmount="60",
            discountUnit="PERCENT",
            discountPriceQty="2",
        ),
        CATALOGUE,
    )
    assert o["produit"] == "Tous les produits BONNE MAMAN présents en magasin"
    assert o["prix"] is None
    assert o["prix_unitaire"] is None
    assert o["reduction"] == "-60 % sur le 2e"


def test_produits_exclus():
    assert convertir(produit(unavailability=["0100", "1067"]), CATALOGUE) is None
    assert convertir(produit(ecatOnly="true"), CATALOGUE) is None


def test_dates_propres_au_produit():
    o = convertir(produit(mandatStartDate="2026-10-27T00:00:00Z", mandatEndDate="2026-10-30T00:00:00Z"), CATALOGUE)
    assert (o["date_debut"], o["date_fin"]) == ("2026-10-27", "2026-10-30")
    # Dates incohérentes : on garde celles du catalogue.
    o = convertir(produit(mandatStartDate="2026-10-27T00:00:00Z", mandatEndDate="2026-07-31T00:00:00Z"), CATALOGUE)
    assert (o["date_debut"], o["date_fin"]) == ("2026-10-20", "2026-10-31")


def test_prix_au_kilo_lu_dans_la_description():
    o = convertir(produit(containerPriceUnit="", price="6.19", description="250 g. Le kg : 24,76 €"), CATALOGUE)
    assert (o["prix_unitaire"], o["unite"]) == (24.76, "kg")


def test_completer_lot_calcule_le_prix_manquant():
    lot = completer_lot({"quantite": 2, "prix": None, "prix_unitaire": None}, 1.72, 4.30, 68, None)
    assert lot == {"quantite": 2, "prix": 2.27, "prix_unitaire": 2.84}
    lot = completer_lot({"quantite": 3, "prix": None, "prix_unitaire": None}, 1.0, 2.0, None, (2, 1))
    assert lot["prix"] == 2.0
