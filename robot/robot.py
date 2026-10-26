"""Robot des promos : récupère les promos de nos magasins et les écrit dans promos.json.

Lancement : python robot/robot.py
"""

import json
import os
import sys
import traceback
from pathlib import Path

from commun import MAGASINS, Navigateur, aujourdhui, maintenant
from sources import dm, lidl_de, lidl_fr

FICHIER = Path(__file__).resolve().parent.parent / "promos.json"

# (identifiant, magasin, description, fonction qui renvoie (offres, remarque))
SOURCES = [
    ("lidl_fr_bonial", "lidl-lingolsheim", "Bonial, page Lidl Lingolsheim", lidl_fr.bonial_lingolsheim),
    ("lidl_fr_prospectus", "lidl-lingolsheim", "Prospectus officiels Lidl France", lidl_fr.prospectus),
    ("lidl_de_marktguru", "lidl-kehl", "Marktguru, Lidl autour de Kehl", lidl_de.lidl_kehl),
    ("dm_kaufda", "dm-kehl", "Kaufda, dm Kehl", dm.dm_kehl),
]


def anciennes_offres():
    """Les offres du passage précédent, pour dépanner si une source tombe en panne."""
    try:
        return json.loads(FICHIER.read_text(encoding="utf-8")).get("offres", [])
    except (OSError, ValueError):
        return []


def main():
    nav = Navigateur()
    avant = anciennes_offres()
    etats, offres = [], []

    for ident, magasin, description, fonction in SOURCES:
        print(f"→ {description}…", flush=True)
        try:
            trouvees, remarque = fonction(nav)
            etat = {"etat": "ok", "nb_offres": len(trouvees), "remarque": remarque}
        except Exception as erreur:
            traceback.print_exc()
            # On garde les offres d'hier de cette source qui sont encore valables.
            trouvees = [o for o in avant if o.get("source") == ident and (o.get("date_fin") or "9") >= aujourdhui()]
            etat = {"etat": "erreur", "nb_offres": len(trouvees),
                    "remarque": f"{type(erreur).__name__}: {erreur}"[:300]
                    + (f" — {len(trouvees)} offres du passage précédent conservées" if trouvees else "")}
        print(f"   {etat['etat']} : {etat['nb_offres']} offres. {etat['remarque']}", flush=True)
        etats.append({"id": ident, "magasin": magasin, "description": description, **etat})
        offres += trouvees

    if all(e["etat"] == "erreur" for e in etats):
        print("Toutes les sources sont en panne : promos.json n'est pas modifié.")
        return 1

    offres.sort(key=lambda o: (o["magasin"], o["date_debut"] or "", (o["produit"] or "").lower()))
    resultat = {
        "mise_a_jour": maintenant(),
        "magasins": MAGASINS,
        "sources": etats,
        "offres": offres,
    }
    FICHIER.write_text(json.dumps(resultat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"promos.json écrit : {len(offres)} offres.")
    ecrire_resume(etats)
    return 0


def ecrire_resume(etats):
    """Petit tableau affiché sur la page du lancement dans GitHub Actions."""
    chemin = os.environ.get("GITHUB_STEP_SUMMARY")
    if not chemin:
        return
    lignes = ["## Résultat du robot", "", "| Source | État | Offres | Remarque |", "|---|---|---|---|"]
    for e in etats:
        icone = "✅" if e["etat"] == "ok" else "❌"
        lignes.append(f"| {e['description']} | {icone} {e['etat']} | {e['nb_offres']} | {e['remarque']} |")
    with open(chemin, "a", encoding="utf-8") as f:
        f.write("\n".join(lignes) + "\n")


if __name__ == "__main__":
    sys.exit(main())
