"""Tests des vignettes des photos (aucun accès à internet : les photos sont fabriquées ici)."""

import io
import json

from PIL import Image

from robot_promos import photos
from robot_promos.config import ADRESSE_PHOTOS, MAGASINS
from robot_promos.offres import creer_offre
from robot_promos.photos import (
    TAILLE,
    nom_logo,
    nom_photo,
    preparer_logos,
    preparer_logos_a_verifier,
    preparer_photos,
    reduire,
    reduire_logo,
)

MEDIA = "https://nos-catalogues-promos-v2.e.leclerc/media/"


def photo_png(largeur=800, hauteur=1000, transparente=True):
    """Un produit rouge au milieu d'un grand fond (transparent ou blanc), comme un « packshot »."""
    image = Image.new("RGBA", (largeur, hauteur), (255, 255, 255, 0 if transparente else 255))
    image.paste((200, 30, 30, 255), (300, 200, 500, 800))
    sortie = io.BytesIO()
    image.save(sortie, "PNG")
    return sortie.getvalue()


class FausseReponse:
    def __init__(self, contenu):
        self.content = contenu


class FauxNavigateur:
    def __init__(self, contenu=None):
        self.contenu = contenu or photo_png()
        self.demandes = []

    def get(self, url, timeout=60):
        self.demandes.append(url)
        if url.endswith("0000000000000000"):
            return FausseReponse(b"pas une image")
        return FausseReponse(self.contenu)


def offre(media):
    return {"id": media, "image": f"{MEDIA}{media}" if media else None}


def test_nom_photo():
    assert nom_photo(f"{MEDIA}a36742fdec095062bc70d90a1edd4f3c") == "a36742fdec095062bc70d90a1edd4f3c.jpg"
    assert nom_photo("https://exemple/media/../../secret") is None
    assert nom_photo(None) is None


def test_reduire_fait_une_vignette_carree_sur_fond_blanc_avec_le_produit_centre():
    for transparente in (True, False):
        vignette = Image.open(io.BytesIO(reduire(photo_png(transparente=transparente))))
        assert vignette.format == "JPEG"
        assert vignette.size == (TAILLE, TAILLE)
        assert vignette.getpixel((2, 2)) >= (250, 250, 250)  # coin blanc, même si l'original est transparent
        rouge, vert, _ = vignette.getpixel((TAILLE // 2, TAILLE // 2))
        assert rouge > 150  # le produit (rouge), au centre
        assert vert < 80
        # Les bords vides sont retirés : le produit (haut et étroit) occupe presque toute la hauteur.
        colonne = [vignette.getpixel((TAILLE // 2, y))[1] for y in range(TAILLE)]
        assert sum(1 for v in colonne if v < 80) > TAILLE * 0.8


def test_preparer_photos_une_seule_fois_par_photo_et_nettoie(tmp_path):
    (tmp_path / "ffffffffffffffffffffffffffffffff.jpg").write_bytes(b"ancienne")  # plus utilisée
    (tmp_path / "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg").write_bytes(b"deja faite")
    offres = [
        offre("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        offre("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),  # même photo pour deux promos
        offre("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
        offre("0000000000000000"),  # illisible
        offre(None),  # pas de photo fiable
    ]
    nav = FauxNavigateur()
    bilan = preparer_photos(nav, offres, tmp_path)

    assert nav.demandes == [f"{MEDIA}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", f"{MEDIA}0000000000000000"]
    assert bilan == {"nouvelles": 1, "en_attente": 0, "erreurs": 1, "retirees": 1, "avec_photo": 3}
    assert sorted(f.name for f in tmp_path.iterdir()) == [
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg",
    ]
    assert offres[0]["photo"] == f"{ADRESSE_PHOTOS}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg"
    assert offres[2]["photo"] == f"{ADRESSE_PHOTOS}bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg"
    assert offres[3]["photo"] is None
    assert offres[4]["photo"] is None


def test_preparer_photos_s_arrete_au_bout_du_temps_prevu(tmp_path):
    secondes = iter(range(0, 1000, 40))  # l'horloge avance de 40 secondes à chaque photo
    offres = [offre(f"{n:032x}") for n in range(1, 6)]
    bilan = preparer_photos(FauxNavigateur(), offres, tmp_path, budget=100, horloge=lambda: next(secondes))
    assert bilan["nouvelles"] == 2  # commencées à 40 et 80 secondes ; à 120, le temps prévu est passé
    assert bilan["en_attente"] == 3  # faites au prochain passage
    assert [o["photo"] is not None for o in offres] == [True, True, False, False, False]


def test_la_commande_photos_complete_promos_json(tmp_path, monkeypatch):
    def offre_complete(id, image):
        return creer_offre(
            id=id,
            source="leclerc",
            magasin="leclerc-geispolsheim",
            catalogue="c",
            produit="Sirop",
            prix=2.75,
            image=image,
        )

    promos = tmp_path / "promos.json"
    document = {
        "format": 2,
        "mise_a_jour": "2026-10-28T06:00:00+01:00",
        "version_robot": "0.12.0",
        "magasins": MAGASINS,
        "sources": [],
        "offres": [offre_complete("a", f"{MEDIA}{'a' * 32}"), offre_complete("b", None)],
    }
    promos.write_text(json.dumps(document), encoding="utf-8")
    monkeypatch.setattr(photos, "Navigateur", FauxNavigateur)
    monkeypatch.setattr(photos, "Avancee", lambda: photos.sans_nouvelles)
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)

    assert photos.main([str(tmp_path / "vignettes"), "--promos", str(promos)]) == 0
    ecrites = json.loads(promos.read_text(encoding="utf-8"))["offres"]
    assert [o["photo"] for o in ecrites] == [f"{ADRESSE_PHOTOS}{'a' * 32}.jpg", None]
    assert [o["logo"] for o in ecrites] == [None, None]  # pas de logo dans le catalogue
    assert (tmp_path / "vignettes" / f"{'a' * 32}.jpg").exists()


def logo_png():
    """Un logo bleu de 600 sur 200 pixels, avec beaucoup de transparent autour."""
    image = Image.new("RGBA", (1200, 600), (0, 0, 0, 0))
    image.paste((20, 60, 200, 255), (300, 200, 900, 400))
    sortie = io.BytesIO()
    image.save(sortie, "PNG")
    return sortie.getvalue()


def test_reduire_logo_petit_png_sur_fond_blanc_sans_les_bords():
    vignette = Image.open(io.BytesIO(reduire_logo(logo_png())))
    assert vignette.format == "PNG"
    assert vignette.size == (288, 96)  # le logo seul (600 sur 200), réduit à 96 pixels de haut
    assert vignette.convert("RGB").getpixel((144, 48))[2] > 150  # bleu


def test_preparer_logos_un_logo_par_marque_pour_toutes_ses_promos(tmp_path):
    (tmp_path / "logos").mkdir()
    (tmp_path / "logos" / f"{'f' * 32}.png").write_bytes(b"ancien")  # plus utilisé
    offres = [
        {"marque": "LACTEL", "logo_catalogue": f"{MEDIA}{'a' * 32}"},
        {"marque": "Lactel", "logo_catalogue": f"{MEDIA}{'a' * 32}"},
        {"marque": "LACTEL", "logo_catalogue": f"{MEDIA}{'b' * 32}"},  # moins fréquent
        {"marque": "LACTEL", "logo_catalogue": None},  # même marque : reçoit son logo
        {"marque": "INCONNUE", "logo_catalogue": None},
        {"marque": None, "logo_catalogue": f"{MEDIA}{'c' * 32}"},  # pas de marque : pas de logo
    ]
    nav = FauxNavigateur(logo_png())
    bilan = preparer_logos(nav, offres, tmp_path, officiels={})

    assert nav.demandes == [f"{MEDIA}{'a' * 32}"]
    attendu = f"{ADRESSE_PHOTOS}logos/{'a' * 32}.png"
    assert [o["logo"] for o in offres] == [attendu, attendu, attendu, attendu, None, None]
    assert [o["logo_marque"] for o in offres] == [None] * 6
    assert sorted(f.name for f in (tmp_path / "logos").iterdir()) == [f"{'a' * 32}.png"]
    assert bilan["marques"] == 1
    assert bilan["avec_logo"] == 4
    assert bilan["retirees"] == 1
    assert bilan["sans_logo"] == ["INCONNUE"]


WIKI = "https://upload.wikimedia.org/wikipedia/commons/"


def test_nom_logo():
    assert nom_logo(f"{MEDIA}{'a' * 32}") == f"{'a' * 32}.png"  # du catalogue : son identifiant
    assert (
        nom_logo(f"{WIKI}c/cb/Haribo.svg/500px-Haribo.svg.png") == "0dc4ba27ee07b1da9ede3b7d8e5a4b6a.png"
    )  # de Wikipédia : une empreinte
    assert nom_logo(None) is None


def test_preparer_logos_marque_repere_et_logos_de_wikipedia(tmp_path):
    officiels = {
        "MARQUE REPÈRE": f"{WIKI}mr.png",
        "HARIBO": f"{WIKI}haribo.png",
        "LACTEL": f"{WIKI}lactel.png",  # le catalogue en donne un : il passe avant
    }
    offres = [
        {"marque": "DÉLISSE", "ean": "3564700012345", "logo_catalogue": None},
        {"marque": "BIO VILLAGE", "ean": "3564709000000", "logo_catalogue": f"{MEDIA}{'b' * 32}"},
        {"marque": "TRADILÈGE", "ean": "3661112057565", "logo_catalogue": None},  # une gamme Marque Repère
        {"marque": "Haribo", "ean": "4001686000000", "logo_catalogue": None},
        {"marque": "LACTEL", "ean": "3428270000000", "logo_catalogue": f"{MEDIA}{'a' * 32}"},
        {"marque": "ECO+", "ean": "3564700099999", "logo_catalogue": None},  # une autre marque de Leclerc
        {"marque": "PANIER DE YOPLAIT", "ean": "3329770000000", "logo_catalogue": None},  # une gamme
        {"marque": "YOPLAIT", "ean": "3329770000001", "logo_catalogue": f"{MEDIA}{'c' * 32}"},
    ]
    nav = FauxNavigateur(logo_png())
    bilan = preparer_logos(nav, offres, tmp_path, officiels=officiels)

    assert sorted(nav.demandes) == sorted(
        [f"{WIKI}mr.png", f"{WIKI}haribo.png", f"{MEDIA}{'a' * 32}", f"{MEDIA}{'c' * 32}"]
    )
    repere = f"{ADRESSE_PHOTOS}logos/{nom_logo(f'{WIKI}mr.png')}"
    assert [o["logo"] for o in offres] == [
        repere,
        repere,
        repere,
        f"{ADRESSE_PHOTOS}logos/{nom_logo(f'{WIKI}haribo.png')}",
        f"{ADRESSE_PHOTOS}logos/{'a' * 32}.png",
        None,
        f"{ADRESSE_PHOTOS}logos/{'c' * 32}.png",  # le logo de YOPLAIT
        f"{ADRESSE_PHOTOS}logos/{'c' * 32}.png",
    ]
    assert [o["logo_marque"] for o in offres] == ["Marque Repère"] * 3 + [None] * 5
    assert bilan["marque_repere"] == 3
    assert bilan["sans_logo"] == ["ECO+"]


def test_les_logos_a_verifier_sont_telecharges_sans_etre_montres(tmp_path):
    (tmp_path / "logos-a-verifier").mkdir()
    (tmp_path / "logos-a-verifier" / "ancien.png").write_bytes(b"plus candidat")
    candidats = {
        "ALPRO": [f"{WIKI}0000000000000000", f"{WIKI}en/alpro.png"],  # pas sur Commons : sur Wikipédia
        "INTROUVABLE": [f"{WIKI}0000000000000000"],
    }
    trouves = preparer_logos_a_verifier(FauxNavigateur(logo_png()), candidats, tmp_path)
    assert trouves == {"ALPRO": nom_logo(f"{WIKI}en/alpro.png"), "INTROUVABLE": None}
    assert sorted(f.name for f in (tmp_path / "logos-a-verifier").iterdir()) == [nom_logo(f"{WIKI}en/alpro.png")]
