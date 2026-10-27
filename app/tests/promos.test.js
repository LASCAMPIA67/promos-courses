import { describe, expect, test } from "vitest";

import {
  articleDepuisPromo,
  chercherPromos,
  dateDuJour,
  formaterJour,
  formaterMoment,
  formaterPrix,
  formaterPrixUnitaire,
  fraicheur,
  indexerPromos,
  infosPromo,
  joliNom,
  motsCles,
  periode,
  phraseSource,
  phrasesFraicheur,
  rechercherPromos,
  resumePromos,
  sourcesEnDifficulte,
} from "../src/promos.js";

// Les espaces insécables des nombres et des dates françaises deviennent de simples espaces.
const simple = (texte) => texte.replace(/[  ]/g, " ");

const AUJOURDHUI = "2026-10-27"; // un mardi

function offre(champs) {
  return {
    source: "lidl",
    magasin: "lidl-lingolsheim",
    marque: null,
    description: null,
    prix: 1,
    ancien_prix: null,
    prix_unitaire: null,
    unite: null,
    reduction: null,
    lot: null,
    carte_fidelite: false,
    date_debut: "2026-10-22",
    date_fin: "2026-10-28",
    ...champs,
  };
}

const OFFRES = [
  offre({ id: "chocolat", produit: "CHOCOLAT AU LAIT", marque: "CÔTE D'OR", source: "leclerc", prix: 2.15 }),
  offre({ id: "lait-uht", produit: "LAIT DEMI-ÉCRÉMÉ UHT", source: "leclerc", date_debut: "2026-10-29", date_fin: "2026-11-04" }),
  offre({ id: "lait", produit: "Lait demi-écrémé", marque: "MILSANI", prix: 0.89 }),
  offre({ id: "laitue", produit: "Laitue", prix: 0.79 }),
  offre({ id: "beurre", produit: "Beurre doux", date_debut: "2026-10-15", date_fin: "2026-10-21" }),
  offre({ id: "nutella", produit: "Pâte à tartiner", marque: "NUTELLA" }),
  offre({ id: "oeufs", produit: "6 œufs frais de poules élevées en plein air" }),
];

const donnees = (champs = {}) => ({ format: 2, offres: OFFRES, ...champs });
const ids = (promos) => promos.map(({ offre }) => offre.id);

describe("motsCles", () => {
  test("simplifie : minuscules, sans accents, au singulier, sans petits mots ni nombres", () => {
    expect(motsCles("Lait demi-écrémé")).toEqual(["lait", "demi", "ecreme"]);
    expect(motsCles("6 Œufs frais de la ferme")).toEqual(["oeuf", "frai", "ferme"]);
    expect(motsCles("Gâteaux au chocolat 500 g")).toEqual(["gateau", "chocolat"]);
    expect(motsCles("Eaux minérales 6 x 1,5 L")).toEqual(["eau", "minerale"]);
    expect(motsCles(null)).toEqual([]);
  });

  test("garde les mots courts comme « riz » ou « jus »", () => {
    expect(motsCles("Riz basmati")).toEqual(["riz", "basmati"]);
    expect(motsCles("Jus d'orange")).toEqual(["jus", "orange"]);
  });
});

describe("indexerPromos", () => {
  test("refuse un fichier d'un autre format", () => {
    expect(() => indexerPromos({ format: 3, offres: [] })).toThrow(/format/);
    expect(() => indexerPromos(null)).toThrow(/format/);
  });
});

describe("chercherPromos", () => {
  const index = indexerPromos(donnees());

  test("trouve les produits qui contiennent l'article, les plus proches d'abord", () => {
    // « Lait demi-écrémé » (en cours) avant « Lait UHT » (à venir), puis « Chocolat au lait ».
    expect(ids(chercherPromos(index, "Lait", AUJOURDHUI))).toEqual(["lait", "lait-uht", "chocolat"]);
  });

  test("ne confond pas un mot avec un autre qui commence pareil", () => {
    expect(ids(chercherPromos(index, "laitue", AUJOURDHUI))).toEqual(["laitue"]);
  });

  test("tous les mots de l'article doivent y être, écrits n'importe comment", () => {
    expect(ids(chercherPromos(index, "lait demi ecreme", AUJOURDHUI))).toEqual(["lait", "lait-uht"]);
    expect(ids(chercherPromos(index, "Lait entier", AUJOURDHUI))).toEqual([]);
    expect(ids(chercherPromos(index, "Oeufs", AUJOURDHUI))).toEqual(["oeufs"]);
  });

  test("cherche aussi dans la marque", () => {
    expect(ids(chercherPromos(index, "Nutella", AUJOURDHUI))).toEqual(["nutella"]);
  });

  test("écarte les promos terminées et signale celles à venir", () => {
    expect(chercherPromos(index, "Beurre", AUJOURDHUI)).toEqual([]);
    const [uht] = chercherPromos(index, "lait uht", AUJOURDHUI);
    expect(uht.aVenir).toBe(true);
    expect(chercherPromos(index, "Lait", AUJOURDHUI)[0].aVenir).toBe(false);
  });

  test("rien à chercher : rien de trouvé", () => {
    expect(chercherPromos(index, "  2 kg ", AUJOURDHUI)).toEqual([]);
    expect(chercherPromos(null, "Lait", AUJOURDHUI)).toEqual([]);
  });
});

describe("rechercherPromos", () => {
  const index = indexerPromos(donnees());

  test("trouve pendant qu'on tape : le début d'un mot suffit", () => {
    expect(ids(rechercherPromos(index, "lai", AUJOURDHUI))).toEqual(["laitue", "lait", "lait-uht", "chocolat"]);
    // Le mot entier d'abord : « Lait », puis « Laitue ».
    expect(ids(rechercherPromos(index, "lait", AUJOURDHUI))).toEqual(["lait", "lait-uht", "laitue", "chocolat"]);
    expect(ids(rechercherPromos(index, "choco", AUJOURDHUI))).toEqual(["chocolat"]);
    expect(ids(rechercherPromos(index, "nute", AUJOURDHUI))).toEqual(["nutella"]);
  });

  test("tous les mots cherchés doivent y être", () => {
    expect(ids(rechercherPromos(index, "lait ecr", AUJOURDHUI))).toEqual(["lait", "lait-uht"]);
    expect(ids(rechercherPromos(index, "lait coco", AUJOURDHUI))).toEqual([]);
  });

  test("filtre par magasin, sans les promos terminées", () => {
    expect(ids(rechercherPromos(index, "lait", AUJOURDHUI, { magasin: "leclerc" }))).toEqual(["lait-uht", "chocolat"]);
    expect(ids(rechercherPromos(index, "lait", AUJOURDHUI, { magasin: "lidl" }))).toEqual(["lait", "laitue"]);
    expect(rechercherPromos(index, "beurre", AUJOURDHUI)).toEqual([]);
  });

  test("rien à chercher : toutes les promos, celles en cours d'abord", () => {
    expect(ids(rechercherPromos(index, "  ", AUJOURDHUI))).toEqual(["chocolat", "lait", "laitue", "nutella", "oeufs", "lait-uht"]);
    expect(ids(rechercherPromos(index, "", AUJOURDHUI, { magasin: "leclerc" }))).toEqual(["chocolat", "lait-uht"]);
    expect(rechercherPromos(null, "lait", AUJOURDHUI)).toEqual([]);
  });
});

describe("articleDepuisPromo", () => {
  test("nom du produit, et une note qui dit où, combien et jusqu'à quand", () => {
    const article = articleDepuisPromo(offre({ produit: "LAIT DEMI-ÉCRÉMÉ UHT", source: "leclerc", prix: 6.12 }), AUJOURDHUI);
    expect(article.nom).toBe("Lait demi-écrémé UHT");
    expect(simple(article.note)).toBe("Promo Leclerc : 6,12 € · Jusqu'à demain");
  });

  test("sans prix, la réduction ; promo à venir ; nom trop long raccourci", () => {
    const gamme = offre({ produit: "Tous les produits BIO", prix: null, reduction: "-34 %", date_debut: "2026-10-29" });
    expect(simple(articleDepuisPromo(gamme, AUJOURDHUI).note)).toBe("Promo Lidl : -34 % · À partir du jeudi 29 octobre");
    expect(articleDepuisPromo(offre({ produit: "x".repeat(150) }), AUJOURDHUI).nom).toHaveLength(100);
  });
});

describe("dates", () => {
  test("date du jour sur le téléphone", () => {
    expect(dateDuJour(new Date(2026, 9, 27, 23, 59))).toBe("2026-10-27");
    expect(dateDuJour(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  test("jours en toutes lettres, avec « 1er »", () => {
    expect(formaterJour("2026-10-28")).toBe("mercredi 28 octobre");
    expect(formaterJour("2026-11-01")).toBe("dimanche 1er novembre");
  });

  test("période de la promo", () => {
    expect(periode(offre({ date_fin: "2026-10-31" }), AUJOURDHUI)).toBe("Jusqu'au samedi 31 octobre");
    expect(periode(offre({ date_fin: "2026-10-28" }), AUJOURDHUI)).toBe("Jusqu'à demain");
    expect(periode(offre({ date_fin: AUJOURDHUI }), AUJOURDHUI)).toBe("Dernier jour aujourd'hui");
    expect(periode(offre({ date_debut: "2026-10-29" }), AUJOURDHUI)).toBe("À partir du jeudi 29 octobre");
    expect(periode(offre({ date_debut: "2026-10-28" }), AUJOURDHUI)).toBe("À partir de demain");
    expect(periode(offre({ date_debut: null, date_fin: null }), AUJOURDHUI)).toBe("");
  });

  test("moment du passage du robot", () => {
    const maintenant = new Date(2026, 9, 27, 9, 0);
    expect(simple(formaterMoment(new Date(2026, 9, 27, 5, 48), maintenant))).toBe("aujourd'hui à 5 h 48");
    expect(simple(formaterMoment(new Date(2026, 9, 26, 5, 7), maintenant))).toBe("hier à 5 h 07");
    expect(simple(formaterMoment(new Date(2026, 9, 25, 5, 48), maintenant))).toBe("dimanche 25 octobre à 5 h 48");
  });

  test("promos trop anciennes quand le robot a manqué un passage", () => {
    const maintenant = new Date("2026-10-27T09:00:00+01:00");
    expect(fraicheur("2026-10-27T05:48:00+01:00", maintenant).ancienne).toBe(false);
    expect(fraicheur("2026-10-26T05:48:00+01:00", maintenant).ancienne).toBe(false);
    expect(fraicheur("2026-10-25T05:48:00+01:00", maintenant).ancienne).toBe(true);
    expect(fraicheur("n'importe quoi", maintenant)).toEqual({ date: null, ancienne: true });
  });

  test("phrases sur la date des promos", () => {
    const maintenant = new Date(2026, 9, 27, 21, 0);
    const recentes = phrasesFraicheur(new Date(2026, 9, 27, 5, 48).toISOString(), maintenant);
    expect(simple(recentes.info)).toBe("Promos Lidl et Leclerc lues par le robot aujourd'hui à 5 h 48.");
    expect(recentes.alerte).toBe("");
    expect(simple(phrasesFraicheur(new Date(2026, 9, 26, 5, 48).toISOString(), maintenant).alerte)).toBe(
      "Les promos datent d'hier à 5 h 48 : le robot n'est pas passé depuis, elles ont pu changer.",
    );
    const anciennes = phrasesFraicheur(new Date(2026, 9, 24, 5, 48).toISOString(), maintenant);
    expect(simple(anciennes.info)).toBe("Promos Lidl et Leclerc lues par le robot le samedi 24 octobre à 5 h 48.");
    expect(simple(anciennes.alerte)).toMatch(/^Les promos datent du samedi 24 octobre à 5 h 48 :/);
    expect(phrasesFraicheur("???", maintenant).alerte).toMatch(/inconnue/);
  });
});

describe("affichage", () => {
  test("prix en euros", () => {
    expect(simple(formaterPrix(0.89))).toBe("0,89 €");
    expect(simple(formaterPrix(12))).toBe("12,00 €");
    expect(simple(formaterPrixUnitaire(9.43, "kg"))).toBe("9,43 €/kg");
    expect(simple(formaterPrixUnitaire(0.92, "l"))).toBe("0,92 €/L");
  });

  test("noms tout en majuscules adoucis", () => {
    expect(joliNom("PIZZA MOELLEUSE ROYALE SURGELÉE")).toBe("Pizza moelleuse royale surgelée");
    expect(joliNom("LAIT DEMI-ÉCRÉMÉ UHT")).toBe("Lait demi-écrémé UHT");
    expect(joliNom("JAMBON DE BAYONNE IGP")).toBe("Jambon de bayonne IGP");
    expect(joliNom("Lait demi-écrémé")).toBe("Lait demi-écrémé");
    expect(joliNom("  6 cailles  sans tête ")).toBe("6 cailles sans tête");
  });

  test("détails : prix au kilo, lot, carte de fidélité", () => {
    expect(infosPromo(offre({ prix: 8.49, prix_unitaire: 9.43, unite: "kg" })).map(simple)).toEqual(["9,43 €/kg"]);
    // Le prix à la pièce d'un produit vendu à la pièce n'apprend rien.
    expect(infosPromo(offre({ prix: 0.79, prix_unitaire: 0.79, unite: "pièce" }))).toEqual([]);
    const lot = { quantite: 3, prix: 4.38, prix_unitaire: 5.07 };
    expect(infosPromo(offre({ prix: 2.19, prix_unitaire: 7.6, unite: "kg", lot })).map(simple)).toEqual([
      "7,60 €/kg",
      "Par 3 : 4,38 € (5,07 €/kg)",
    ]);
    expect(infosPromo(offre({ carte_fidelite: true }))).toEqual(["avec Lidl Plus"]);
    expect(infosPromo(offre({ source: "leclerc", carte_fidelite: true }))).toEqual(["avec la carte E.Leclerc"]);
    // Déjà dit dans la réduction : pas besoin de le répéter.
    expect(infosPromo(offre({ carte_fidelite: true, reduction: "-20 % avec Lidl Plus" }))).toEqual([]);
  });

  test("résumé par magasin", () => {
    const index = indexerPromos(donnees());
    expect(resumePromos(chercherPromos(index, "Lait", AUJOURDHUI))).toBe("3 promos : 1 chez Lidl, 2 chez Leclerc");
    expect(resumePromos(chercherPromos(index, "Laitue", AUJOURDHUI))).toBe("1 promo chez Lidl");
  });

  test("magasins dont les promos sont incomplètes", () => {
    const fichier = {
      magasins: { "leclerc-geispolsheim": { nom: "E.Leclerc Geispolsheim" } },
      sources: [
        { magasin: "lidl-lingolsheim", nom: "Prospectus Lidl", etat: "ok" },
        { magasin: "leclerc-geispolsheim", nom: "Catalogues Leclerc", etat: "erreur" },
      ],
    };
    expect(sourcesEnDifficulte(fichier)).toEqual([{ nom: "E.Leclerc Geispolsheim", etat: "erreur" }]);
    expect(sourcesEnDifficulte(null)).toEqual([]);
  });

  test("explication du problème d'un magasin", () => {
    expect(phraseSource({ nom: "E.Leclerc Geispolsheim", etat: "erreur" })).toBe(
      "Les promos d'E.Leclerc Geispolsheim n'ont pas pu être mises à jour : ce sont celles du passage précédent.",
    );
    expect(phraseSource({ nom: "Lidl Lingolsheim", etat: "partiel" })).toBe(
      "Une partie des promos de Lidl Lingolsheim n'a pas pu être mise à jour.",
    );
  });
});
