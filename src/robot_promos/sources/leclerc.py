"""E.Leclerc Geispolsheim : les catalogues officiels du magasin.

1. La page du magasin sur e.leclerc liste ses catalogues en cours et à venir.
2. Pour chacun, le service des catalogues Leclerc (celui qu'utilise la visionneuse officielle
   nos-catalogues-promos-v2.e.leclerc) donne tous les produits : prix, réduction, prix au kilo…

Ce service n'accepte que les demandes qui disent venir de la visionneuse officielle (en-têtes
Origin et Referer). Décision d'Emilio du 26/10/2026 : on l'accepte, car le robot ne lit que ce que
n'importe qui voit dans son navigateur, sans compte ni captcha, et se présente sous son vrai nom.
"""

import re
import unicodedata

from robot_promos.config import LECLERC_NUMERO_MAGASIN as NUMERO
from robot_promos.offres import creer_offre
from robot_promos.outils import aujourdhui, nombre
from robot_promos.sources import Catalogue, Source

PAGE_MAGASIN = "https://www.e.leclerc/mag/e-leclerc-geispolsheim"
API = "https://nos-catalogues-promos-v2-api.e.leclerc"
VISIONNEUSE = "https://nos-catalogues-promos-v2.e.leclerc"
ENTETES = {"Origin": VISIONNEUSE, "Referer": VISIONNEUSE + "/", "Accept": "application/json"}
UNITES = {"le kg": "kg", "le l": "l", "la pièce": "pièce"}

# Change quand la façon de lire un catalogue change : chaque catalogue est alors relu une fois, au
# prochain passage, au lieu de garder les offres lues à l'ancienne (2 : photos fiables, 3 : logos).
LECTURE = 3


class Leclerc(Source):
    id = "leclerc"
    magasin = "leclerc-geispolsheim"
    nom = "Catalogues E.Leclerc Geispolsheim"

    def catalogues(self, nav):
        page = nav.get(PAGE_MAGASIN).text
        codes = list(dict.fromkeys(re.findall(r'data-operation-code="([A-Za-z0-9]+)"', page)))
        if not codes:
            raise ValueError("aucun catalogue trouvé sur la page du magasin (le site a peut-être changé)")
        resultat = []
        for code in codes:
            op = nav.get(f"{API}/{code}/{NUMERO}", headers=ENTETES).json()
            fin = (op.get("end_date") or "")[:10] or None
            if fin and fin < aujourdhui():
                continue
            nom = op.get("catch_phrase") or op.get("name") or code
            if "EXPRESS" in (op.get("name") or "").upper():
                nom += " (version courte)"  # Leclerc publie aussi une version réduite de certains catalogues
            resultat.append(
                Catalogue(
                    id=code,
                    nom=nom,
                    debut=(op.get("start_date") or "")[:10] or None,
                    fin=fin,
                    version=f"{op.get('documentUid')}@{op.get('updatedDate')}#lecture-{LECTURE}",
                    lien=f"{VISIONNEUSE}/catalog/{code}/{NUMERO}",
                    donnees={"document": op.get("documentUid")},
                )
            )
        return resultat

    def offres(self, nav, catalogue):
        if not catalogue.donnees.get("document"):
            return []
        produits = nav.get(
            f"{API}/document/{catalogue.donnees['document']}/products", headers=ENTETES, timeout=120
        ).json()
        offres = [convertir(p, catalogue) for p in produits]
        return [o for o in offres if o]


def sans_accents(texte):
    return "".join(c for c in unicodedata.normalize("NFD", texte) if unicodedata.category(c) != "Mn")


def en_texte(montant):
    """60.0 -> « 60 » ; 0.85 -> « 0,85 »."""
    return f"{montant:g}".replace(".", ",") if montant else "?"


def convertir(p, catalogue):
    """Transforme un produit du catalogue Leclerc en offre (ou None s'il n'est pas pour nous)."""
    if NUMERO in (p.get("unavailability") or []):
        return None  # pas vendu dans notre magasin
    if str(p.get("ecatOnly")).lower() == "true":
        return None  # seulement sur internet

    nom = (p.get("name") or "").strip() or p.get("brand") or "?"
    toute_la_gamme = nom.upper().startswith("SUR LES PRODUITS")
    libelle = sans_accents(p.get("discountLabel") or "").upper()
    montant = nombre(p.get("discountAmount"))
    en_pourcent = p.get("discountUnit") == "PERCENT"
    mentions = p.get("mechanicMentions") or {}

    prix_rayon = nombre(p.get("price"))
    prix_sans_remise = nombre(p.get("priceWithoutDiscount"))
    prix_ticket = nombre(p.get("priceWithTEL"))
    prix, ancien_prix, reduction, lot = prix_rayon, prix_sans_remise, None, None
    carte = bool(mentions.get("reservedForCardholders"))
    description = p.get("description") or ""

    if "TEL" in libelle.split() or "TICKET" in libelle:
        # « Ticket E.Leclerc » : la remise est créditée sur la carte de fidélité.
        carte = True
        reduction = f"{en_texte(montant)} {'%' if en_pourcent else '€'} en Ticket E.Leclerc"
        if mentions.get("fromXProductPurchase"):
            reduction += " " + mentions["fromXProductPurchase"].lower()
        if prix_ticket and prix_rayon and prix_ticket < prix_rayon:
            prix, ancien_prix = prix_ticket, prix_rayon
    elif "XEME" in libelle:
        quantite = int(nombre(p.get("discountPriceQty")) or 2)
        reduction = f"-{en_texte(montant)} % sur le {quantite}e"
        lot = {"quantite": quantite, "prix": p.get("discountedPriceLot"), "prix_unitaire": p.get("containerPrice")}
        ancien_prix = None
    elif "OFFERT" in libelle:
        payes, offerts = int(nombre(p.get("offertX")) or 0), int(nombre(p.get("offertY")) or 0)
        par = re.search(r"Par (\d+)[^:]*:\s*(\d+(?:[.,]\d+)?)\s*€", description)
        if not payes:
            payes, offerts = (int(par.group(1)) - 1, 1) if par else (1, 1)
        reduction = f"{payes} + {offerts} offert{'s' if offerts > 1 else ''}"
        prix_lot = nombre(p.get("discountedPriceLot")) or (nombre(par.group(2)) if par else None)
        if "1 ACHETE" in libelle and prix_lot is None:
            prix_lot = prix_rayon
        lot = {"quantite": payes + offerts, "prix": prix_lot, "prix_unitaire": p.get("containerPrice")}
        ancien_prix = None
    elif montant and ("BRII" in libelle or "BARRE" in libelle):
        reduction = f"-{en_texte(montant)} {'%' if en_pourcent else '€'}"

    unite = UNITES.get((p.get("containerPriceUnit") or "").strip().lower())
    prix_unitaire = calculer_prix_unitaire(p, prix, prix_rayon, prix_sans_remise) if unite and prix else None
    if not prix_unitaire and prix:
        # Parfois, le prix au kilo n'est écrit que dans la description (« 250 g. Le kg : 24,76 € »).
        trouve = re.search(r"Le (kg|L) : (\d+(?:[.,]\d+)?)", description)
        if trouve and nombre(trouve.group(2)):
            # Ce prix au kilo correspond au prix affiché en rayon (déjà réduit en cas de remise immédiate).
            prix_affiche = prix if prix_sans_remise else (prix_rayon or prix)
            unite = trouve.group(1).lower()
            prix_unitaire = round(nombre(trouve.group(2)) * prix / prix_affiche, 2)

    if lot:
        lot = completer_lot(lot, prix, prix_unitaire, montant if en_pourcent else None, payes_offerts(reduction))

    if toute_la_gamme:
        # Offre valable sur toute une marque : pas de prix unique (et Leclerc tronque le nom).
        nom = f"Tous les produits {p.get('brand') or 'de la gamme'} présents en magasin"
        prix = ancien_prix = prix_unitaire = None
        if lot:
            lot["prix"] = lot["prix_unitaire"] = None

    debut, fin = catalogue.debut, catalogue.fin
    mandat_debut, mandat_fin = (p.get("mandatStartDate") or "")[:10], (p.get("mandatEndDate") or "")[:10]
    if mandat_debut and mandat_fin and mandat_debut <= mandat_fin:
        debut, fin = mandat_debut, mandat_fin  # dates propres à ce produit

    return creer_offre(
        id=f"leclerc-{catalogue.id}-{(p.get('uid') or '')[:12]}".lower(),
        source="leclerc",
        magasin="leclerc-geispolsheim",
        catalogue=catalogue.id,
        produit=nom,
        marque=p.get("brand"),
        description=description,
        categorie=p.get("section") or p.get("thematic"),
        ean=p.get("ean"),
        prix=prix,
        ancien_prix=ancien_prix,
        prix_unitaire=prix_unitaire,
        unite=unite,
        reduction=reduction,
        lot=lot,
        carte_fidelite=carte,
        date_debut=debut,
        date_fin=fin,
        lien=catalogue.lien,
        image=None if toute_la_gamme else photo_fiable(p, nom),
        logo_catalogue=logo_de_la_marque(p, p.get("brand")),
    )


def simplifier(texte):
    """« Crème  Douche.jpg » -> « creme douche » : pour comparer des noms écrits différemment."""
    texte = re.sub(r"\.(jpe?g|png|webp|tiff?)$", "", (texte or "").strip(), flags=re.IGNORECASE)
    return " ".join(sans_accents(texte).lower().split())


def photo_fiable(p, nom):
    """L'adresse de la photo du produit lui-même, seulement si on est sûr que c'est la bonne ; sinon None.

    Le catalogue donne des photos « packshot » (le produit seul, son emballage) et des photos
    d'« ambiance » (un plat, une mise en scène) : seules les premières comptent. Et la photo doit porter
    dans son nom le code-barres du produit (le cas de presque toutes), ou exactement le nom du produit
    (« VODKA PEACH »). Les photos génériques (« 26G310G_5_AMB ») ou d'un autre produit sont écartées :
    mieux vaut pas de photo qu'une photo trompeuse.
    """
    codes = {str(code).strip() for code in [p.get("ean"), *(p.get("eans") or [])] if code}
    codes |= {code.lstrip("0") for code in codes}
    codes.discard("")
    for image in p.get("imagesV2") or []:
        fichier = image.get("name") or ""
        if image.get("type") != "packshot" or not image.get("url") or re.search(r"(^|_)(AMB|BBZ)(_|\.|$)", fichier):
            continue
        if any(code in fichier for code in codes) or simplifier(fichier) == simplifier(nom):
            return image["url"]
    return None


def payes_offerts(reduction):
    """« 2 + 1 offert » -> (2, 1) ; sinon None."""
    trouve = re.match(r"(\d+) \+ (\d+) offert", reduction or "")
    return (int(trouve.group(1)), int(trouve.group(2))) if trouve else None


def completer_lot(lot, prix, prix_unitaire, remise_en_pourcent, payes_et_offerts):
    """Calcule le prix total du lot (et son prix au kilo) quand le catalogue ne le donne pas."""
    quantite = lot["quantite"]
    prix_lot = nombre(lot.get("prix"))
    if not prix_lot and prix:
        if payes_et_offerts:
            prix_lot = round(prix * payes_et_offerts[0], 2)
        elif remise_en_pourcent:
            prix_lot = round(prix * (quantite - 1) + prix * (1 - remise_en_pourcent / 100), 2)
    lot_unitaire = nombre(lot.get("prix_unitaire"))
    if prix_lot and prix_unitaire and prix and not (lot_unitaire and lot_unitaire < prix_unitaire):
        lot_unitaire = round(prix_unitaire * prix_lot / (prix * quantite), 2)
    if not (lot_unitaire and prix_unitaire and lot_unitaire < prix_unitaire):
        lot_unitaire = None
    return {"quantite": quantite, "prix": prix_lot, "prix_unitaire": lot_unitaire}


def calculer_prix_unitaire(p, prix, prix_rayon, prix_sans_remise):
    """Prix au kilo / litre / pièce correspondant à `prix` (pour UN article)."""
    apres = nombre(p.get("containerPrice"))
    avant = nombre(p.get("containerPriceBeforeMeca"))
    if prix_sans_remise:  # remise immédiate : le prix affiché est déjà réduit
        if apres:
            return apres
        if avant:
            return avant if abs(avant - prix) < 0.01 else round(avant * prix / prix_sans_remise, 2)
        return None
    base = avant or apres
    if base and prix_rayon:
        return round(base * prix / prix_rayon, 2)
    return None


def mots(texte):
    """« LACTEL-LOGO.png » -> ["lactel", "logo"] : minuscules, sans accents ni extension ni ponctuation."""
    texte = re.sub(r"\.(jpe?g|png|svg|eps|ai|tiff?|webp)$", "", sans_accents(texte or "").lower().strip())
    return [mot for mot in re.split(r"[^a-z0-9]+", texte) if mot]


def logo_de_la_marque(p, marque):
    """L'adresse du logo de la marque du produit, donné par le catalogue, seulement si on est sûr.

    Le catalogue joint parfois des « logos » à un produit : celui de sa marque, mais aussi des labels
    (« POMMES_DE_FRANCE ») ou des visuels publicitaires. On ne garde que celui dont le nom de fichier
    contient exactement la marque, en mots entiers qui se suivent (« LACTEL-LOGO », « PNG-LOGO
    INNOCENT », « AIRWICK » pour AIR WICK) ; jamais un nom qui la contient seulement en partie
    (« Clementoni » n'est pas CLÉMENT).
    """
    cible = "".join(mots(marque))
    if not cible:
        return None
    for logo in p.get("logosV2") or []:
        if logo.get("type") != "logo" or not logo.get("url"):
            continue
        nom = mots(logo.get("name"))
        if any("".join(nom[debut:fin]) == cible for debut in range(len(nom)) for fin in range(debut + 1, len(nom) + 1)):
            return logo["url"]
    return None
