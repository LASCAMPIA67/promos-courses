"""Lecture du prospectus PDF de Lidl France.

Le PDF contient du vrai texte, écrit avec des polices bien distinctes :
- le nom du produit en « LidlFontCondPro-Bold » (taille 10) ;
- la description en « LidlFontCondPro-Book » (taille 8) ;
- le numéro d'article tout petit (« n° 80000 ») ;
- le prix en très gros, dans la police « LidlFontPrice » ;
- l'ancien prix barré, en petit, à droite du prix ; la réduction (« -34% ») au-dessus ;
- le logo Lidl Plus : un carré bleu à côté de la réduction.

On regroupe les lignes de texte en « blocs produit », puis on associe chaque gros prix au bloc
le plus proche (le prix est à droite du texte ou en dessous, presque jamais au-dessus ou à gauche).
"""

import math
import re
from dataclasses import dataclass, field

EXPOSANTS = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")
BLEU_LIDL = (0.0, 0.327, 0.609)
DISTANCE_MAX = 140  # au-delà, un prix et un texte ne vont pas ensemble
DISTANCE_MAX_VARIANTE = 300


def police(mot):
    return mot["fontname"].split("+")[-1]


def est_nom(m):
    return police(m) == "LidlFontCondPro-Bold" and 8.5 <= m["size"] <= 11.5


def est_description(m):
    return police(m) == "LidlFontCondPro-Book" and 6.5 <= m["size"] <= 9


def est_code(m):
    return police(m).startswith("LidlFontPro-Regular") and m["size"] < 5


def est_prix(m):
    return "LidlFontPrice" in police(m) and m["size"] >= 20


@dataclass
class Ligne:
    mots: list
    genre: str  # « nom », « desc » ou « code »

    @property
    def x0(self):
        return self.mots[0]["x0"]

    @property
    def x1(self):
        return self.mots[-1]["x1"]

    @property
    def top(self):
        return min(m["top"] for m in self.mots)

    @property
    def bottom(self):
        return max(m["bottom"] for m in self.mots)

    @property
    def texte(self):
        return " ".join(m["text"] for m in self.mots)


@dataclass
class Bloc:
    lignes: list = field(default_factory=list)

    def boite(self):
        return (
            min(ligne.x0 for ligne in self.lignes),
            min(ligne.top for ligne in self.lignes),
            max(ligne.x1 for ligne in self.lignes),
            max(ligne.bottom for ligne in self.lignes),
        )

    def texte(self, genre):
        return " ".join(ligne.texte for ligne in self.lignes if ligne.genre == genre)

    @property
    def code(self):
        chiffres = re.findall(r"\d{4,8}", self.texte("code"))
        return chiffres[-1] if chiffres else None


@dataclass
class ProduitBrut:
    """Ce que le PDF dit d'un produit, avant mise en forme."""

    nom: str
    description: str
    code: str | None
    prix: float
    ancien_prix: float | None = None
    badge: str | None = None
    lidl_plus: bool = False
    en_ligne_seulement: bool = False
    variante: str | None = None
    page: int | None = None


def faire_lignes(mots):
    """Regroupe les mots d'un même genre en lignes (même hauteur, mots proches)."""
    lignes = []
    for genre, test in (("nom", est_nom), ("desc", est_description), ("code", est_code)):
        choisis = sorted((m for m in mots if test(m)), key=lambda m: (round(m["top"]), m["x0"]))
        courante = None
        for m in choisis:
            precedent = courante.mots[-1] if courante else None
            if precedent and abs(m["top"] - precedent["top"]) < 1.5 and 0 <= m["x0"] - precedent["x1"] < 8:
                courante.mots.append(m)
            else:
                courante = Ligne([m], genre)
                lignes.append(courante)
    return lignes


# Un bloc se lit de haut en bas : nom (sur une ou plusieurs lignes), description, numéro d'article.
SUITES_PERMISES = {("nom", "nom"), ("nom", "desc"), ("desc", "desc"), ("desc", "code"), ("nom", "code")}


def faire_blocs(lignes):
    """Assemble les lignes alignées à gauche et collées verticalement en blocs produit."""
    lignes = sorted(lignes, key=lambda ligne: (ligne.top, ligne.x0))
    blocs, bloc_de = [], {}
    for i, ligne in enumerate(lignes):
        parent = None
        for j in range(i - 1, -1, -1):
            dessus = lignes[j]
            if ligne.top - dessus.top > 16:
                break
            bloc = bloc_de.get(id(dessus))
            if (
                abs(dessus.x0 - ligne.x0) <= 3.5
                and -2.5 <= ligne.top - dessus.bottom <= 6.5
                and (dessus.genre, ligne.genre) in SUITES_PERMISES
                and bloc
                and bloc.lignes[-1] is dessus
            ):
                parent = bloc
                break
        if parent is None:
            parent = Bloc()
            blocs.append(parent)
        parent.lignes.append(ligne)
        bloc_de[id(ligne)] = parent
    return [b for b in blocs if b.texte("nom")]


def lire_prix(mots):
    """Fusionne les morceaux d'un même prix (« 12 » + « .⁹⁹ ») et renvoie [(valeur, boîte)]."""
    morceaux = sorted((m for m in mots if est_prix(m)), key=lambda m: (round(m["top"] / 5), m["x0"]))
    groupes = []
    for m in morceaux:
        groupe = groupes[-1] if groupes else None
        if groupe and abs(m["top"] - groupe[-1]["top"]) < 12 and 0 <= m["x0"] - groupe[-1]["x1"] < 6:
            groupe.append(m)
        else:
            groupes.append([m])
    resultat = []
    for groupe in groupes:
        texte = "".join(m["text"] for m in groupe).translate(EXPOSANTS).replace(",", ".")
        texte = re.sub(r"[^\d.]", "", texte)
        if re.fullmatch(r"\d+(\.\d{1,2})?", texte) and float(texte) > 0:
            boite = {
                "x0": groupe[0]["x0"],
                "x1": groupe[-1]["x1"],
                "top": min(m["top"] for m in groupe),
                "bottom": max(m["bottom"] for m in groupe),
            }
            resultat.append((float(texte), boite))
    return resultat


def distance(prix, bloc):
    """Distance entre un prix et un bloc de texte, pénalisée pour les positions inhabituelles."""
    x0, y0, x1, y1 = bloc
    dx = max(x0 - prix["x1"], 0, prix["x0"] - x1)
    dy = max(y0 - prix["bottom"], 0, prix["top"] - y1)
    d = math.hypot(dx, dy)
    if x0 > prix["x1"]:  # prix à gauche du texte
        d += 80
    if prix["bottom"] < y0:  # prix au-dessus du texte
        d += 60
    return d


def extraire(mots, formes, page=None):
    """Trouve les produits d'une page à partir de ses mots et de ses formes (rectangles colorés)."""
    blocs = faire_blocs(faire_lignes(mots))
    prix = lire_prix(mots)
    logos_lidl_plus = [
        f
        for f in formes
        if tuple(round(v, 3) for v in (f.get("couleur") or ())) == BLEU_LIDL
        and 18 <= f["x1"] - f["x0"] <= 60
        and abs((f["x1"] - f["x0"]) - (f["bottom"] - f["top"])) < 3
    ]

    # 1. Chaque prix va avec le bloc le plus proche (les paires les plus proches d'abord).
    paires = sorted(
        (distance(boite, blocs[j].boite()), i, j) for i, (_, boite) in enumerate(prix) for j in range(len(blocs))
    )
    prix_pris, blocs_pris, associations = set(), set(), []
    for d, i, j in paires:
        if i in prix_pris or j in blocs_pris or d > DISTANCE_MAX:
            continue
        prix_pris.add(i)
        blocs_pris.add(j)
        associations.append((i, j, False))
    # 2. Les prix restants sont souvent des variantes (tailles) d'un produit déjà trouvé.
    for i, (_, boite) in enumerate(prix):
        if i in prix_pris or not blocs:
            continue
        d, j = min((distance(boite, b.boite()), j) for j, b in enumerate(blocs))
        if d <= DISTANCE_MAX_VARIANTE:
            associations.append((i, j, True))
    variantes = {j for _, j, est_variante in associations if est_variante}

    produits = []
    for i, j, _ in associations:
        valeur, boite = prix[i]
        bloc = blocs[j]
        badge = trouver_badge(mots, boite)
        produits.append(
            ProduitBrut(
                nom=bloc.texte("nom"),
                description=bloc.texte("desc"),
                code=bloc.code,
                prix=valeur,
                ancien_prix=trouver_ancien_prix(mots, boite, badge),
                badge=badge["text"].replace("﹪", "%") if badge else None,
                lidl_plus=any(
                    boite["x0"] - 20 <= f["x0"] <= boite["x1"] + 90 and boite["top"] - 70 <= f["top"] <= boite["bottom"]
                    for f in logos_lidl_plus
                )
                or "lidl plus" in bloc.texte("desc").lower(),
                en_ligne_seulement="uniquement en ligne" in texte_au_dessus(mots, bloc.boite()).lower(),
                variante=etiquette_variante(mots, boite) if j in variantes else None,
                page=page,
            )
        )
    return produits


def trouver_badge(mots, prix):
    """La réduction affichée au-dessus du prix : « -34% », « -30€ », « 2+1 »…"""
    badges = [
        m
        for m in mots
        if police(m) == "LidlFontPro-Bold"
        and 15 <= m["size"] <= 45
        and re.fullmatch(r"-\d+[%﹪€]|\d\+\d", m["text"])
        and prix["x0"] - 40 <= m["x0"] <= prix["x1"] + 20
        and prix["top"] - 60 <= m["top"] <= prix["top"] + 5
    ]
    return min(badges, key=lambda m: abs(m["top"] - prix["top"]) + abs(m["x0"] - prix["x0"])) if badges else None


def trouver_ancien_prix(mots, prix, badge):
    """Le petit prix barré, à droite du gros prix (ou à droite de la réduction)."""
    haut = (badge["top"] if badge else prix["top"]) - 8
    gauche = badge["x0"] if badge else prix["x1"] - 8
    anciens = [
        m
        for m in mots
        if police(m).startswith("LidlFontCondPro")
        and 8.5 <= m["size"] <= 14
        and re.fullmatch(r"\d+[.,]\d{2}", m["text"])
        and gauche <= m["x0"] <= prix["x1"] + 70
        and haut <= m["top"] <= prix["bottom"]
    ]
    return float(anciens[0]["text"].replace(",", ".")) if anciens else None


def texte_au_dessus(mots, boite):
    x0, y0, x1, _ = boite
    return " ".join(m["text"] for m in mots if y0 - 30 <= m["top"] < y0 and x0 - 5 <= m["x0"] <= x1 + 40)


def etiquette_variante(mots, prix):
    """Petit texte juste au-dessus d'un prix de variante (ex. « Ø 20 cm »)."""
    morceaux = [
        m
        for m in mots
        if prix["top"] - 40 <= m["top"] < prix["top"] - 2
        and prix["x0"] - 10 <= m["x0"] <= prix["x1"]
        and m["text"].upper() != "SEULEMENT"
        and not re.fullmatch(r"-\d+[%﹪€]|\d+[.,]\d{2}", m["text"])
    ]
    morceaux.sort(key=lambda m: (round(m["top"]), m["x0"]))
    return " ".join(m["text"] for m in morceaux) or None


# ---------------------------------------------------------------------------------------------
# Lecture des textes


def titre_de_page(caracteres):
    """Texte du bandeau en haut de page (« Jeudi 22/10 »), en gardant celui dessiné en dernier.

    Certaines pages superposent plusieurs bandeaux : seul le dernier dessiné est visible.
    """
    morceaux, courant, dernier_x = [], [], None
    for c in caracteres:
        if c["top"] < 40 and 15 <= c["size"] <= 19:
            if dernier_x is not None and c["x0"] < dernier_x - 3:
                morceaux.append("".join(courant))
                courant = []
            courant.append(c["text"])
            dernier_x = c["x0"]
    if courant:
        morceaux.append("".join(courant))
    for texte in reversed(morceaux):
        if re.search(r"\d{1,2}/\d{1,2}", texte):
            return texte
    return None


def pied_de_page(caracteres):
    """Validité écrite en bas de page, ex. « Du jeudi au dimanche » -> ("jeudi", "dimanche")."""
    texte = "".join(c["text"] for c in caracteres if c["top"] > 735 and 8 <= c["size"] <= 13)
    jours = "lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche"
    m = re.search(rf"[Dd]u ({jours}) au ({jours})", texte)
    return (m.group(1), m.group(2)) if m else None


PRIX = r"(\d+(?:[.,]\d{1,2})?)\s*€"
PRIX_UNITAIRE = r"\(\s*1\s*(kg|l)\s*=\s*" + PRIX + r"\s*\)"


def analyser_description(texte):
    """Repère dans la description les informations utiles.

    Exemples :
    - « 600 g (1 kg = 7,08 €) avec Lidl Plus au lieu de 5,29 € (1 kg = 8,82 €) »
    - « Le produit de 400 g : 2,65 € (1 kg = 6,63 €) Les 2 produits : 4,24 € (1 kg = 5,30 €) »
    - « Le produit de 75 cl : 3,99 € Les 3 produits dont 1 OFFERT : 7,98 € »
    """
    infos = {}
    lot = re.search(r"Les (\d+) produits( dont (\d+) OFFERTS?)?\s*:\s*" + PRIX, texte, re.IGNORECASE)
    avant_lot = texte[: lot.start()] if lot else texte
    seul = re.search(r"Le produit de [^:]+:\s*" + PRIX, avant_lot, re.IGNORECASE)
    if lot:
        infos["lot_quantite"] = int(lot.group(1))
        infos["lot_offerts"] = int(lot.group(3)) if lot.group(3) else 0
        infos["lot_prix"] = float(lot.group(4).replace(",", "."))
        unitaire_lot = re.search(PRIX_UNITAIRE, texte[lot.end() : lot.end() + 40], re.IGNORECASE)
        if unitaire_lot:
            infos["lot_prix_unitaire"] = float(unitaire_lot.group(2).replace(",", "."))
    if seul:
        infos["prix_normal"] = float(seul.group(1).replace(",", "."))
    unitaire = re.search(PRIX_UNITAIRE, avant_lot, re.IGNORECASE)
    if unitaire:
        infos["unite"] = unitaire.group(1).lower()
        infos["prix_unitaire"] = float(unitaire.group(2).replace(",", "."))
    elif re.search(r"\ble kilo\b|(?<![\d,.])1 kg\b", avant_lot, re.IGNORECASE):
        infos["unite"] = "kg"
        infos["par_kilo"] = True
    elif re.search(r"\bla pièce\b(?!\s*(d['’]|de\b))", avant_lot, re.IGNORECASE):  # pas « la pièce d'environ 2 kg »
        infos["unite"] = "pièce"
        infos["par_kilo"] = True
    au_lieu = re.search(r"au lieu de\s*" + PRIX, avant_lot, re.IGNORECASE)
    if au_lieu:
        infos["au_lieu_de"] = float(au_lieu.group(1).replace(",", "."))
    infos["lidl_plus"] = bool(re.search(r"avec lidl plus", texte, re.IGNORECASE))
    return infos


def separer_marque(nom):
    """« SILVERCREST Machine à pâtes » -> ("SILVERCREST", "Machine à pâtes").

    Chez Lidl, la marque est écrite en majuscules au début du nom.
    """
    mots = nom.split()
    marque = []
    for mot in mots:
        lettres = re.sub(r"[^A-Za-zÀ-ÖØ-öø-ÿ]", "", mot)
        if lettres and lettres.isupper() and (len(lettres) > 1 or marque):
            marque.append(mot)
        else:
            break
    if marque and len(marque) < len(mots):
        return " ".join(marque).replace("®", "").strip(), " ".join(mots[len(marque) :])
    return None, nom
