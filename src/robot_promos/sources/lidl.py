"""Lidl France (Lingolsheim) : les prospectus officiels de la semaine.

1. La page « catalogues en ligne » de lidl.fr donne les prospectus de la semaine en cours et de
   la suivante.
2. Le service des prospectus du groupe Lidl (endpoints.leaflets.schwarz, utilisé par lidl.fr) donne
   pour chacun ses dates, l'adresse du PDF et l'image de chaque page.
3. On télécharge le PDF (une seule fois par version) et on lit les produits (voir lidl_pdf.py).

Le site lidl.fr n'affiche pas les prix alimentaires : le PDF est la seule source complète.
"""

import io
import re

import pdfplumber

from robot_promos.offres import creer_offre
from robot_promos.outils import aujourdhui, date_jj_mm, identifiant, nettoyer, prochain_jour
from robot_promos.sources import Catalogue, Source
from robot_promos.sources.lidl_pdf import (
    analyser_description,
    extraire,
    pied_de_page,
    separer_marque,
    titre_de_page,
)

PAGE_CATALOGUES = "https://www.lidl.fr/c/catalogues-en-ligne/s10017753"
API_PROSPECTUS = "https://endpoints.leaflets.schwarz/v4/flyer"


class Lidl(Source):
    id = "lidl"
    magasin = "lidl-lingolsheim"
    nom = "Prospectus Lidl France"

    def catalogues(self, nav):
        page = nav.get(PAGE_CATALOGUES).text
        noms = list(dict.fromkeys(re.findall(r"/l/[a-z0-9-]+/([a-z0-9-]+)/ar/0", page)))
        if not noms:
            raise ValueError("aucun prospectus trouvé sur lidl.fr (le site a peut-être changé)")
        resultat = []
        for nom in noms:
            p = nav.get(API_PROSPECTUS, params={"flyer_identifier": nom, "region_id": 0}).json()["flyer"]
            titre = f"{p.get('title') or ''} {p.get('name') or ''}"
            if "web" in titre.lower():
                continue  # « Exclus Web » : vendus seulement sur internet
            fin = p.get("offerEndDate") or p.get("endDate")
            if not p.get("pdfUrl") or (fin and fin < aujourdhui()):
                continue
            resultat.append(
                Catalogue(
                    id=nom,
                    nom=f"{p.get('title')} ({p.get('name')})",
                    debut=p.get("offerStartDate") or p.get("startDate"),
                    fin=fin,
                    version=f"{p['pdfUrl']}#{p.get('fileSize')}",
                    lien=(p.get("flyerUrlAbsolute") or "").split("?")[0] or None,
                    donnees={
                        "pdf": p["pdfUrl"],
                        "images": {pg.get("number"): pg.get("image") for pg in p.get("pages") or []},
                    },
                )
            )
        return resultat

    def offres(self, nav, catalogue):
        contenu = nav.get(catalogue.donnees["pdf"], timeout=300).content
        offres, en_ligne = [], 0
        with pdfplumber.open(io.BytesIO(contenu)) as pdf:
            for numero, page_brute in enumerate(pdf.pages, start=1):
                page = page_brute.dedupe_chars(tolerance=1)
                debut, fin = dates_de_la_page(page.chars, catalogue)
                mots = page.extract_words(extra_attrs=["size", "fontname"])
                formes = [
                    {
                        "x0": f["x0"],
                        "x1": f["x1"],
                        "top": f["top"],
                        "bottom": f["bottom"],
                        "couleur": f.get("non_stroking_color"),
                    }
                    for f in page.rects + page.curves
                ]
                for brut in extraire(mots, formes, page=numero):
                    if brut.en_ligne_seulement:
                        en_ligne += 1
                        continue
                    offres.append(convertir(brut, catalogue, debut, fin))
                page_brute.close()
        catalogue.donnees["en_ligne_ignorees"] = en_ligne
        return offres


def dates_de_la_page(caracteres, catalogue):
    """Dates de validité d'une page : bandeau du haut (« Jeudi 22/10 »), bas de page (« Du jeudi au dimanche »)."""
    debut, fin = catalogue.debut, catalogue.fin
    titre = titre_de_page(caracteres)
    if titre and debut:
        dates = [date_jj_mm(d, debut) for d in re.findall(r"\d{1,2}/\d{1,2}", titre)]
        dates = [d for d in dates if d]
        if dates:
            debut = dates[0]
        if len(dates) > 1 and re.search(r"\bau\b", titre):
            fin = dates[1]
    pied = pied_de_page(caracteres)
    if pied and debut:
        fin = prochain_jour(debut, pied[1])
    if fin and debut and fin < debut:
        fin = catalogue.fin
    return debut, fin


def convertir(brut, catalogue, debut, fin):
    """Transforme un produit lu dans le PDF en offre."""
    infos = analyser_description(brut.description)
    marque, produit = separer_marque(nettoyer(brut.nom) or "")
    if brut.variante:
        produit = f"{produit} ({nettoyer(brut.variante)})"
    carte = brut.lidl_plus or infos["lidl_plus"]
    prix, ancien_prix, reduction, lot = brut.prix, brut.ancien_prix, brut.badge, None

    if "lot_quantite" in infos:
        # « Le produit : 2,65 € — Les 2 produits : 4,24 € » : le gros prix n'est pas celui d'un article seul.
        quantite, offerts = infos["lot_quantite"], infos["lot_offerts"]
        normal = infos.get("prix_normal") or ancien_prix
        lot = {"quantite": quantite, "prix": infos["lot_prix"], "prix_unitaire": infos.get("lot_prix_unitaire")}
        if offerts:
            reduction = f"{quantite - offerts} + {offerts} offert{'s' if offerts > 1 else ''}"
        elif normal and quantite > 1:
            dernier = infos["lot_prix"] - normal * (quantite - 1)
            if 0 <= dernier < normal:
                reduction = f"-{round((1 - dernier / normal) * 100)} % sur le {quantite}e"
        if normal:
            prix = normal
        ancien_prix = None
    elif infos.get("au_lieu_de"):
        ancien_prix = infos["au_lieu_de"]  # le texte est plus sûr que la position du prix barré
    if carte and reduction:
        reduction = f"{reduction} avec Lidl Plus"

    prix_unitaire = infos.get("prix_unitaire")
    if infos.get("par_kilo"):
        prix_unitaire = prix  # « Le kilo » / « La pièce » : le prix affiché est déjà le prix unitaire

    return creer_offre(
        id=f"lidl-{identifiant(debut)}-{brut.code or identifiant(produit, prix)}",
        source="lidl",
        magasin="lidl-lingolsheim",
        catalogue=catalogue.id,
        produit=produit,
        marque=marque,
        description=brut.description,
        prix=prix,
        ancien_prix=ancien_prix,
        prix_unitaire=prix_unitaire,
        unite=infos.get("unite"),
        reduction=reduction,
        lot=lot,
        carte_fidelite=carte,
        date_debut=debut,
        date_fin=fin,
        lien=catalogue.lien,
        image=catalogue.donnees.get("images", {}).get(brut.page),
        page=brut.page,
    )
