"""Tests des vignettes des photos (aucun accès à internet : les photos sont fabriquées ici)."""

import io

from PIL import Image

from robot_promos.config import ADRESSE_PHOTOS
from robot_promos.photos import TAILLE, nom_photo, preparer_photos, reduire

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
