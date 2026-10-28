import pytest

from robot_promos.sources import Catalogue
from robot_promos.sources.leclerc import completer_lot, convertir, logo_de_la_marque, marque_du_logo, photo_fiable

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
        "ean": "3018257905006",
        "imagesV2": [
            {"type": "packshot", "name": "3018257905006.jpg", "url": "https://exemple/media/a1"},
            {"type": "ambiance", "name": "AMB_3018257905006.jpg", "url": "https://exemple/media/b2"},
        ],
    }
    return base | champs


def test_prix_simple():
    o = convertir(produit(), CATALOGUE)
    assert (o["prix"], o["ancien_prix"], o["reduction"], o["lot"]) == (2.0, None, None, None)
    assert (o["prix_unitaire"], o["unite"]) == (8.0, "kg")
    assert (o["date_debut"], o["date_fin"]) == ("2026-10-20", "2026-10-31")
    assert o["image"] == "https://exemple/media/a1"
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


def photo(type_, nom, url="https://exemple/media/x"):
    return {"type": type_, "name": nom, "url": url}


def test_photo_fiable_seulement_celle_du_produit():
    # La photo du produit (son code-barres dans le nom), jamais celle d'ambiance, même placée avant.
    ambiance_d_abord = produit(
        imagesV2=[photo("ambiance", "AMB_3018257905006.jpg", "amb"), photo("packshot", "3018257905006.jpg", "ok")]
    )
    assert photo_fiable(ambiance_d_abord, "PRODUIT") == "ok"
    # Un des codes-barres d'une promo « au choix », ou sans le 0 du début.
    assert (
        photo_fiable(
            produit(
                ean=None,
                eans=["3564706769809", "3564706768932"],
                imagesV2=[photo("packshot", "24G_3564706768932", "ok")],
            ),
            "x",
        )
        == "ok"
    )
    assert (
        photo_fiable(produit(ean="03222270171359", imagesV2=[photo("packshot", "3222270171359.png", "ok")]), "x")
        == "ok"
    )
    # Pas de code-barres dans le nom, mais exactement le nom du produit (accents, espaces, extension).
    assert photo_fiable(produit(imagesV2=[photo("packshot", " Crème  Douche.jpg", "ok")]), "CRÈME DOUCHE") == "ok"


def test_photo_fiable_ecarte_les_photos_douteuses():
    douteuses = [
        [photo("ambiance", "AMB_3018257905006.jpg")],  # ambiance seulement (produit frais)
        [photo("packshot", "26G310G_5_AMB")],  # « packshot » qui est en fait une ambiance
        [photo("packshot", "21G309G_5_BBZ")],  # photo générique
        [photo("packshot", "24G303G_3266110907173")],  # le code-barres d'un autre produit
        [photo("packshot", "VODAK RASPBERRI")],  # nom différent
        [photo("packshot", "3018257905006.jpg", url=None)],
        [],
    ]
    for images in douteuses:
        assert photo_fiable(produit(imagesV2=images), "VODKA RASPBERRI") is None, images


def test_pas_de_photo_pour_toute_une_gamme():
    o = convertir(produit(name="SUR LES PRODUITS PRÉSENTS EN MAGASIN DE LA MARQUE"), CATALOGUE)
    assert o["image"] is None


def logo(nom, url="https://exemple/media/logo"):
    return {"type": "logo", "name": nom, "url": url}


def test_logo_de_la_marque_seulement_s_il_porte_exactement_son_nom():
    bons = {
        "LACTEL": "LACTEL-LOGO",
        "INNOCENT": "PNG-LOGO INNOCENT",
        "AIR WICK": "AIRWICK",
        "WILLIAM LAWSON'S": "WILLIAM_LAWSONS",
        "NESTLÉ": "NESTLE",
        "GLENLIVET": "THE GLENLIVET",
        "Martini": "Logo Martini.png",
    }
    for marque, nom in bons.items():
        assert logo_de_la_marque(produit(logosV2=[logo(nom)]), marque) == "https://exemple/media/logo", marque
    douteux = {
        "CLÉMENT": "Clementoni",  # une autre marque qui commence pareil
        "MAISON MONTFORT": "MONTFORT",  # pas toute la marque (et pas dans les noms vérifiés)
        "PANIER DU PRIMEUR": "POMMES_DE_FRANCE",  # un label
        "KELLOGG'S": "11 - DEPENSER MOINS 4 - MARQUES PREFEREES-1542-POU",  # un visuel publicitaire
        "": "LACTEL-LOGO",  # pas de marque
    }
    for marque, nom in douteux.items():
        assert logo_de_la_marque(produit(logosV2=[logo(nom)]), marque) is None, marque
    # Les autres noms vérifiés à l'œil : seulement pour leur marque.
    assert logo_de_la_marque(produit(logosV2=[logo("PASQUIER")]), "Brioche Pasquier") == "https://exemple/media/logo"
    assert logo_de_la_marque(produit(logosV2=[logo("l’or")]), "L'OR ESPRESSO") == "https://exemple/media/logo"
    assert logo_de_la_marque(produit(logosV2=[logo("PASQUIER")]), "PASQUIER FRÈRES") is None
    # Seulement les « logos » (pas les pictogrammes), avec une adresse.
    assert logo_de_la_marque(produit(logosV2=[{"type": "picto", "name": "LACTEL", "url": "x"}]), "LACTEL") is None
    assert logo_de_la_marque(produit(logosV2=[logo("LACTEL", url=None)]), "LACTEL") is None


def test_l_offre_garde_le_logo_de_sa_marque():
    o = convertir(
        produit(brand="LACTEL", logosV2=[logo("POMMES_DE_FRANCE", "label"), logo("LACTEL-LOGO", "ok")]), CATALOGUE
    )
    assert o["logo_catalogue"] == "ok"


def test_un_produit_sans_marque_prend_celle_de_son_logo():
    assert marque_du_logo(produit(logosV2=[logo("DORITOS")]), "DORITOS") == "DORITOS"
    assert marque_du_logo(produit(logosV2=[logo("MONSTER MUNCH")]), "MONSTER MUNCH BARBECUE") == "MONSTER MUNCH"
    assert marque_du_logo(produit(logosV2=[logo("LOGO-CÔTE D'OR.png")]), "CÔTE D'OR NOIR 70 %") == "CÔTE D'OR"
    assert marque_du_logo(produit(logosV2=[logo("POMMES_DE_FRANCE")]), "POMMES GALA") is None  # un label
    assert marque_du_logo(produit(logosV2=[logo("KINDER")]), "SCHOKOBONS KINDER") is None  # pas au début
    assert marque_du_logo(produit(logosV2=[logo("LU")]), "LUTTI") is None  # en mots entiers
    o = convertir(produit(name="KINDER SCHOKOBONS", brand=None, logosV2=[logo("KINDER SCHOKOBONS", "ok")]), CATALOGUE)
    assert (o["marque"], o["logo_catalogue"]) == ("KINDER SCHOKOBONS", "ok")
