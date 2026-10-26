"""Les sources de promos. Chaque source sait lister ses catalogues, puis lire les offres d'un catalogue."""

from dataclasses import dataclass, field


@dataclass
class Catalogue:
    """Un catalogue (prospectus) d'un magasin."""

    id: str
    nom: str
    debut: str | None
    fin: str | None
    # Change quand le catalogue est modifié : sinon, le robot réutilise les offres de la veille.
    version: str
    lien: str | None = None
    donnees: dict = field(default_factory=dict, repr=False)  # informations internes, non enregistrées

    def resume(self, nb_offres, reutilise):
        return {
            "id": self.id,
            "nom": self.nom,
            "debut": self.debut,
            "fin": self.fin,
            "version": self.version,
            "lien": self.lien,
            "nb_offres": nb_offres,
            "reutilise": reutilise,
        }


class Source:
    """Modèle commun à toutes les sources."""

    id = ""
    magasin = ""
    nom = ""

    def catalogues(self, nav):
        """Renvoie la liste des catalogues en cours et à venir."""
        raise NotImplementedError

    def offres(self, nav, catalogue):
        """Renvoie la liste des offres d'un catalogue."""
        raise NotImplementedError
