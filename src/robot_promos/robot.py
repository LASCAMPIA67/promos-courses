"""Chef d'orchestre : interroge chaque source, puis écrit promos.json.

Lancement : python -m robot_promos   (options : --help)
"""

import argparse
import json
import os
import sys
import traceback
from collections import Counter
from pathlib import Path

from robot_promos import __version__
from robot_promos.config import MAGASINS
from robot_promos.offres import dedoublonner, verifier
from robot_promos.outils import aujourdhui, maintenant
from robot_promos.sources.leclerc import Leclerc
from robot_promos.web import Navigateur

FORMAT = 2  # version du format de promos.json (voir docs/format-promos.md)
SOURCES = [Leclerc()]


def lire_precedent(fichier):
    """Le promos.json du passage précédent, pour réutiliser les catalogues inchangés ou dépanner."""
    try:
        return json.loads(Path(fichier).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def offres_precedentes(precedent, source, catalogue=None):
    return [
        o
        for o in precedent.get("offres", [])
        if o.get("source") == source and (catalogue is None or o.get("catalogue") == catalogue)
    ]


def traiter_source(nav, source, precedent, utiliser_cache=True):
    """Renvoie (état de la source, offres trouvées). Ne lève jamais d'erreur."""
    anciens = {
        c["id"]: c for s in precedent.get("sources", []) if s.get("id") == source.id for c in s.get("catalogues", [])
    }
    etat = {
        "id": source.id,
        "magasin": source.magasin,
        "nom": source.nom,
        "etat": "ok",
        "nb_offres": 0,
        "remarque": "",
        "catalogues": [],
    }
    try:
        catalogues = source.catalogues(nav)
    except Exception as erreur:  # noqa: BLE001 — une source en panne ne doit pas arrêter les autres
        traceback.print_exc()
        offres = [o for o in offres_precedentes(precedent, source.id) if (o.get("date_fin") or "9") >= aujourdhui()]
        etat.update(
            etat="erreur",
            nb_offres=len(offres),
            remarque=f"{type(erreur).__name__} : {erreur}"[:300]
            + (f" — {len(offres)} offres du passage précédent conservées" if offres else ""),
        )
        etat["catalogues"] = [c for c in anciens.values() if (c.get("fin") or "9") >= aujourdhui()]
        return etat, offres

    offres, erreurs, reutilises, en_ligne = [], [], 0, 0
    for catalogue in catalogues:
        ancien = anciens.get(catalogue.id)
        if utiliser_cache and ancien and ancien.get("version") == catalogue.version:
            trouvees = offres_precedentes(precedent, source.id, catalogue.id)
            reutilise = True
        else:
            try:
                trouvees = source.offres(nav, catalogue)
                en_ligne += catalogue.donnees.get("en_ligne_ignorees", 0)
                reutilise = False
            except Exception as erreur:  # noqa: BLE001
                traceback.print_exc()
                erreurs.append(f"{catalogue.nom} : {type(erreur).__name__} : {erreur}"[:200])
                trouvees = offres_precedentes(precedent, source.id, catalogue.id)
                reutilise = bool(trouvees)
        reutilises += reutilise
        offres += trouvees
        etat["catalogues"].append(catalogue.resume(len(trouvees), reutilise))

    morceaux = [f"{len(catalogues)} catalogue(s)"]
    if reutilises:
        morceaux.append(f"{reutilises} inchangé(s) depuis le dernier passage")
    if en_ligne:
        morceaux.append(f"{en_ligne} produit(s) « uniquement en ligne » ignoré(s)")
    if erreurs:
        etat["etat"] = "partiel"
        morceaux.append("erreurs : " + " | ".join(erreurs))
    etat.update(nb_offres=len(offres), remarque=" ; ".join(morceaux))
    return etat, offres


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m robot_promos", description=__doc__.splitlines()[0])
    parser.add_argument("--sortie", default="promos.json", help="fichier à écrire (par défaut : promos.json)")
    parser.add_argument("--sans-cache", action="store_true", help="relire tous les catalogues, même inchangés")
    parser.add_argument("--version", action="version", version=f"robot_promos {__version__}")
    args = parser.parse_args(argv)

    precedent = lire_precedent(args.sortie)
    nav = Navigateur()
    etats, offres = [], []
    for source in SOURCES:
        print(f"→ {source.nom}…", flush=True)
        etat, trouvees = traiter_source(nav, source, precedent, utiliser_cache=not args.sans_cache)
        print(f"   {etat['etat']} : {etat['nb_offres']} offres. {etat['remarque']}", flush=True)
        if etat["etat"] != "ok" and os.environ.get("GITHUB_ACTIONS"):
            print(f"::warning title={source.nom}::{etat['remarque']}")
        etats.append(etat)
        offres += trouvees

    if all(e["etat"] == "erreur" for e in etats):
        print("Toutes les sources sont en panne : promos.json n'est pas modifié.")
        return 1

    offres = [o for o in offres if (o.get("date_fin") or "9") >= aujourdhui()]  # promos terminées
    offres = dedoublonner(offres)
    offres.sort(key=lambda o: (o["magasin"], o["date_debut"] or "", o["catalogue"], (o["produit"] or "").lower()))
    # Les compteurs reflètent le fichier final (sans les doublons ni les promos terminées).
    compte = Counter((o["source"], o["catalogue"]) for o in offres)
    for etat in etats:
        for catalogue in etat["catalogues"]:
            catalogue["nb_offres"] = compte[(etat["id"], catalogue["id"])]
        etat["nb_offres"] = sum(c["nb_offres"] for c in etat["catalogues"])
    document = {
        "format": FORMAT,
        "mise_a_jour": maintenant(),
        "version_robot": __version__,
        "magasins": MAGASINS,
        "sources": etats,
        "offres": offres,
    }
    verifier(document)
    Path(args.sortie).write_text(json.dumps(document, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{args.sortie} écrit : {len(offres)} offres ({nav.nb_requetes} requêtes).")
    ecrire_resume(etats, len(offres))
    return 0


def ecrire_resume(etats, total):
    """Tableau affiché sur la page du lancement dans GitHub Actions."""
    chemin = os.environ.get("GITHUB_STEP_SUMMARY")
    if not chemin:
        return
    icones = {"ok": "✅", "partiel": "⚠️", "erreur": "❌"}
    lignes = [
        f"## Résultat du robot — {total} offres",
        "",
        "| Source | État | Offres | Remarque |",
        "|---|---|---|---|",
    ]
    lignes.extend(
        f"| {e['nom']} | {icones[e['etat']]} {e['etat']} | {e['nb_offres']} | {e['remarque']} |" for e in etats
    )
    lignes += [
        "",
        "### Catalogues",
        "",
        "| Magasin | Catalogue | Du | Au | Offres | Relu |",
        "|---|---|---|---|---|---|",
    ]
    for e in etats:
        for c in e["catalogues"]:
            lignes.append(
                f"| {MAGASINS[e['magasin']]['nom']} | {c['nom']} | {c['debut']} | {c['fin']} | "
                f"{c['nb_offres']} | {'non (inchangé)' if c['reutilise'] else 'oui'} |"
            )
    with Path(chemin).open("a", encoding="utf-8") as f:
        f.write("\n".join(lignes) + "\n")


if __name__ == "__main__":
    sys.exit(main())
