import { describe, expect, test } from "vitest";

import {
  articleDepuisPromo,
  chercherPromos,
  explicationPrix,
  dateDuJour,
  formaterJour,
  formaterMoment,
  formaterPrix,
  formaterPrixUnitaire,
  fraicheur,
  indexerPromos,
  joliNom,
  motsCles,
  noteCourte,
  periode,
  periodeCourte,
  phraseSource,
  prixUnitaire,
  phrasesFraicheur,
  rechercherPromos,
  regrouper,
  regrouperVariantes,
  resumeDescription,
  sourcesEnDifficulte,
  typePromo,
} from "../src/promos.js";

// Les espaces insécables des nombres et des dates françaises deviennent de simples espaces.
const simple = (texte) => texte.replace(/[\u00a0\u202f]/g, " ");

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
  offre({
    id: "lait-uht",
    produit: "LAIT DEMI-ÉCRÉMÉ UHT",
    source: "leclerc",
    date_debut: "2026-10-29",
    date_fin: "2026-11-04",
  }),
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
    // Les noms qui commencent par « lait » (Leclerc d'abord, même à venir), puis « Chocolat au lait ».
    expect(ids(chercherPromos(index, "Lait", AUJOURDHUI))).toEqual(["lait-uht", "lait", "chocolat"]);
  });

  test("ne confond pas un mot avec un autre qui commence pareil", () => {
    expect(ids(chercherPromos(index, "laitue", AUJOURDHUI))).toEqual(["laitue"]);
  });

  test("tous les mots de l'article doivent y être, écrits n'importe comment", () => {
    expect(ids(chercherPromos(index, "lait demi ecreme", AUJOURDHUI))).toEqual(["lait-uht", "lait"]);
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
    expect(chercherPromos(index, "Lait", AUJOURDHUI).find(({ offre }) => offre.id === "lait").aVenir).toBe(false);
  });

  test("rien à chercher : rien de trouvé", () => {
    expect(chercherPromos(index, "  2 kg ", AUJOURDHUI)).toEqual([]);
    expect(chercherPromos(null, "Lait", AUJOURDHUI)).toEqual([]);
  });
});

describe("rechercherPromos", () => {
  const index = indexerPromos(donnees());

  test("trouve pendant qu'on tape : le début d'un mot suffit", () => {
    expect(ids(rechercherPromos(index, "lai", AUJOURDHUI))).toEqual(["lait-uht", "laitue", "lait", "chocolat"]);
    // Le mot entier d'abord : « Lait », puis « Laitue ».
    expect(ids(rechercherPromos(index, "lait", AUJOURDHUI))).toEqual(["lait-uht", "lait", "laitue", "chocolat"]);
    expect(ids(rechercherPromos(index, "choco", AUJOURDHUI))).toEqual(["chocolat"]);
    expect(ids(rechercherPromos(index, "nute", AUJOURDHUI))).toEqual(["nutella"]);
  });

  test("tous les mots cherchés doivent y être", () => {
    expect(ids(rechercherPromos(index, "lait ecr", AUJOURDHUI))).toEqual(["lait-uht", "lait"]);
    expect(ids(rechercherPromos(index, "lait coco", AUJOURDHUI))).toEqual([]);
  });

  test("filtre par magasin, sans les promos terminées", () => {
    expect(ids(rechercherPromos(index, "lait", AUJOURDHUI, { magasin: "leclerc" }))).toEqual(["lait-uht", "chocolat"]);
    expect(ids(rechercherPromos(index, "lait", AUJOURDHUI, { magasin: "lidl" }))).toEqual(["lait", "laitue"]);
    expect(rechercherPromos(index, "beurre", AUJOURDHUI)).toEqual([]);
  });

  test("rien à chercher : toutes les promos, celles en cours d'abord", () => {
    expect(ids(rechercherPromos(index, "  ", AUJOURDHUI))).toEqual([
      "chocolat",
      "lait",
      "laitue",
      "nutella",
      "oeufs",
      "lait-uht",
    ]);
    expect(ids(rechercherPromos(index, "", AUJOURDHUI, { magasin: "leclerc" }))).toEqual(["chocolat", "lait-uht"]);
    expect(rechercherPromos(null, "lait", AUJOURDHUI)).toEqual([]);
  });
});

describe("familles de produits", () => {
  const index = indexerPromos({
    format: 2,
    offres: [
      offre({ id: "pringles", produit: "PRINGLES" }),
      offre({ id: "lays", produit: "Chips", marque: "LAY’S" }),
      offre({ id: "doritos", produit: "DORITOS", source: "leclerc" }),
      offre({ id: "changes", produit: "CHANGES BEBE", marque: "PAMPERS", source: "leclerc" }),
      offre({ id: "shampooing", produit: "Shampooing familial", marque: "CIEN" }),
      offre({ id: "pate", produit: "Pâté de volaille" }),
      offre({ id: "pates", produit: "Pâtes fraîches" }),
      offre({ id: "marrons", produit: "Marrons glacés" }),
      offre({ id: "magnum", produit: "Utopia double noisettes", marque: "MAGNUM" }),
    ],
  });

  test("« chips » trouve aussi les marques de chips, après les produits qui s'appellent « chips »", () => {
    expect(ids(chercherPromos(index, "Chips", AUJOURDHUI))).toEqual(["lays", "doritos", "pringles"]);
  });

  test("les noms d'une même famille sont équivalents", () => {
    expect(ids(chercherPromos(index, "Couches", AUJOURDHUI))).toEqual(["changes"]);
    expect(ids(chercherPromos(index, "shampoing", AUJOURDHUI))).toEqual(["shampooing"]);
    expect(ids(chercherPromos(index, "Glaces", AUJOURDHUI))).toEqual(["magnum"]);
  });

  test("les faux amis ne se confondent pas : pâtes et pâté, glace et glacé", () => {
    expect(ids(chercherPromos(index, "Pâtes", AUJOURDHUI))).toEqual(["pates"]);
    expect(ids(chercherPromos(index, "pâté", AUJOURDHUI))).toEqual(["pate"]);
    expect(ids(chercherPromos(index, "Marrons glacés", AUJOURDHUI))).toEqual(["marrons"]);
  });

  test("dans la recherche, il faut le nom complet de la famille", () => {
    expect(ids(rechercherPromos(index, "chips", AUJOURDHUI))).toEqual(["lays", "doritos", "pringles"]);
    expect(ids(rechercherPromos(index, "chi", AUJOURDHUI))).toEqual(["lays"]);
  });

  test("regroupe les mots : une famille en plusieurs mots compte pour un", () => {
    expect(regrouper(motsCles("Papier toilette doux")).map(({ mots }) => mots.join(" "))).toEqual([
      "papier toilette",
      "dou",
    ]);
    expect(regrouper(motsCles("Chips paprika"))[0].equivalents).toContainEqual(["pringle"]);
    expect(regrouper(motsCles("Lait"))).toEqual([{ mots: ["lait"], equivalents: [] }]);
  });
});

describe("Leclerc d'abord", () => {
  test("à pertinence égale, les promos Leclerc passent avant celles de Lidl", () => {
    const index = indexerPromos({
      format: 2,
      offres: [
        offre({ id: "lidl", produit: "Lait demi-écrémé", source: "lidl" }),
        offre({ id: "leclerc", produit: "Lait entier", source: "leclerc" }),
        offre({ id: "chocolat", produit: "Chocolat au lait", source: "leclerc" }),
      ],
    });
    // Les noms qui commencent par « lait » d'abord (Leclerc puis Lidl), puis « Chocolat au lait ».
    expect(ids(chercherPromos(index, "Lait", AUJOURDHUI))).toEqual(["leclerc", "lidl", "chocolat"]);
  });
});

describe("explicationPrix : comment lire le prix", () => {
  const texte = (e) => ({
    ...e,
    prix: e.prix && simple(e.prix),
    barre: e.barre && simple(e.barre),
    detail: e.detail && simple(e.detail),
  });

  test("Ticket E.Leclerc : on paie le prix plein, et ce que ça revient une fois le Ticket rendu", () => {
    const e = texte(
      explicationPrix(
        offre({
          source: "leclerc",
          prix: 2.76,
          ancien_prix: 3.95,
          reduction: "30 % en Ticket E.Leclerc",
          carte_fidelite: true,
        }),
      ),
    );
    expect(e).toEqual({
      genre: "carte-leclerc",
      prix: "3,95 €",
      barre: null,
      unitaire: null,
      detail: "revient à 2,76 €",
    });
  });

  test("réduction immédiate : ancien prix barré, rien de plus à dire", () => {
    const e = texte(explicationPrix(offre({ source: "leclerc", prix: 2.15, ancien_prix: 2.69, reduction: "-20 %" })));
    expect(e).toMatchObject({ genre: "caisse", prix: "2,15 €", barre: "2,69 €", detail: null });
    const carte = explicationPrix(
      offre({ source: "leclerc", prix: 5.25, ancien_prix: 7, reduction: "-25 %", carte_fidelite: true }),
    );
    expect(carte.genre).toBe("carte-caisse");
  });

  test("lot : le prix à l'unité, et le prix en prenant plusieurs", () => {
    const lot = { quantite: 2, prix: 3.57, prix_unitaire: 6.56 };
    const e = texte(
      explicationPrix(
        offre({ source: "leclerc", prix: 2.55, prix_unitaire: 9.38, unite: "kg", reduction: "-60 % sur le 2e", lot }),
      ),
    );
    expect(e).toMatchObject({ genre: "lot", prix: "2,55 €", detail: "3,57 € les 2 (6,56 €/kg)" });
    expect(simple(e.unitaire)).toBe("9,38 €/kg");
    // Un prix de lot douteux n'est pas affiché.
    const douteux = offre({
      prix: 8.69,
      reduction: "-50 % sur le 2e",
      lot: { quantite: 2, prix: 8.69, prix_unitaire: null },
    });
    expect(explicationPrix(douteux).detail).toBeNull();
  });

  test("Lidl Plus : le prix avec l'appli, et sans", () => {
    const e = texte(
      explicationPrix(
        offre({ prix: 1.99, ancien_prix: 2.49, reduction: "-20 % avec Lidl Plus", carte_fidelite: true }),
      ),
    );
    expect(e).toMatchObject({ genre: "lidl-plus", prix: "1,99 €", detail: "sans l'appli : 2,49 €" });
    expect(explicationPrix(offre({ prix: 0.99, carte_fidelite: true })).detail).toBeNull();
    const lot = { quantite: 2, prix: 3.59, prix_unitaire: 8.98 };
    const enLot = texte(
      explicationPrix(offre({ prix: 2.39, reduction: "-50 % sur le 2e avec Lidl Plus", carte_fidelite: true, lot })),
    );
    expect(enLot.detail).toBe("3,59 € les 2");
  });

  test("sans réduction : le prix du catalogue", () => {
    expect(explicationPrix(offre({ prix: 12.49 }))).toMatchObject({ genre: "aucun", detail: null });
  });
});

describe("regrouperVariantes : une même promo « au choix » n'est montrée qu'une fois", () => {
  const variante = (id, produit, champs = {}) => ({
    offre: offre({
      id,
      produit,
      marque: "LE PETIT MARSEILLAIS",
      source: "leclerc",
      prix: 2.24,
      ancien_prix: 3.73,
      reduction: "-40 %",
      ...champs,
    }),
    aVenir: false,
  });

  test("les variantes sont réunies : nom le plus court, prix au litre gardé, place de la mieux classée", () => {
    const resultats = regrouperVariantes([
      variante("a", "SHAMPOOING PURIFIANT"),
      { offre: offre({ id: "autre", produit: "Gel douche" }), aVenir: false },
      variante("b", "SHAMPOOING", { description: "Au choix : Douceur, Nutrition, Purifiant. 2 x 300 ml" }),
      variante("c", "SHAMPOOING", { prix_unitaire: 3.73, unite: "l" }),
    ]);
    expect(resultats.map(({ offre: o }) => o.id)).toEqual(["a", "autre"]);
    expect(resultats[0].offre).toMatchObject({
      produit: "SHAMPOOING",
      description: "Au choix : Douceur, Nutrition, Purifiant. 2 x 300 ml",
      prix_unitaire: 3.73,
      unite: "l",
      variantes: 3,
    });
  });

  test("des promos différentes restent séparées", () => {
    const resultats = regrouperVariantes([
      variante("a", "SHAMPOOING"),
      variante("b", "SHAMPOOING", { prix: 4.17, ancien_prix: 6.95 }), // autre prix
      variante("c", "APRÈS-SHAMPOOING"), // autre produit
      variante("d", "SHAMPOOING", { source: "lidl" }), // autre magasin
      variante("e", "SHAMPOOING", { date_fin: "2026-11-07" }), // autres dates
    ]);
    expect(resultats).toHaveLength(5);
    expect(resultats[0].offre.variantes).toBeUndefined();
  });

  test("dans la recherche et les étiquettes de la liste aussi", () => {
    const index = indexerPromos({
      format: 2,
      offres: [variante("a", "SHAMPOOING").offre, variante("b", "SHAMPOOING PURIFIANT").offre],
    });
    expect(chercherPromos(index, "Shampooing", AUJOURDHUI)).toHaveLength(1);
    expect(rechercherPromos(index, "sham", AUJOURDHUI)).toHaveLength(1);
  });
});

describe("typePromo : le type de promo, en quelques mots, pour la liste", () => {
  const type = (champs) => simple(typePromo(offre(champs)));

  test("en prenant plusieurs : la réduction du lot", () => {
    const lot = { quantite: 2, prix: 3.15, prix_unitaire: 2.76 };
    expect(type({ source: "leclerc", prix: 2.25, reduction: "-60 % sur le 2e", lot })).toBe("-60 % sur le 2e");
    expect(type({ source: "leclerc", prix: 0.95, reduction: "2 + 1 offert", lot })).toBe("2 + 1 offert");
    expect(type({ source: "leclerc", prix: 0.95, lot })).toBe("En prenant plusieurs");
  });

  test("en caisse, avec la carte, sur la carte E.Leclerc, avec Lidl Plus", () => {
    expect(type({ source: "leclerc", prix: 2.15, ancien_prix: 2.69, reduction: "-20 %" })).toBe("-20 % en caisse");
    expect(type({ prix: 0.75, ancien_prix: 1 })).toBe("-25 % en caisse"); // calculé d'après l'ancien prix
    expect(type({ source: "leclerc", prix: 5.25, ancien_prix: 7, reduction: "-25 %", carte_fidelite: true })).toBe(
      "-25 % avec la carte",
    );
    expect(
      type({
        source: "leclerc",
        prix: 2.76,
        ancien_prix: 3.95,
        reduction: "30 % en Ticket E.Leclerc",
        carte_fidelite: true,
      }),
    ).toBe("30 % sur la carte");
    expect(type({ prix: 1.29, ancien_prix: 1.69, reduction: "-23 % avec Lidl Plus", carte_fidelite: true })).toBe(
      "-23 % Lidl Plus",
    );
    expect(type({ prix: 0.99, carte_fidelite: true })).toBe("Prix Lidl Plus");
  });

  test("sans réduction particulière : le prix", () => {
    expect(type({ prix: 12.49 })).toBe("12,49 €");
    expect(type({ prix: null })).toBe("Prix du catalogue");
  });
});

describe("resumeDescription", () => {
  test("retire ce qui répète le prix", () => {
    expect(
      resumeDescription("4 tranches. 140 g.Le kg : 11,36 €.Par 2 (280 g) : 2,38 € au lieu de 3,18 €.Le kg : 8,50 €"),
    ).toBe("4 tranches · 140 g");
    expect(
      resumeDescription("250 g (1 kg = 7,96 €) avec Lidl Plus au lieu de 2,49 € (1 kg = 9,96 €) Saveur barbecue"),
    ).toBe("250 g · Saveur barbecue");
    expect(
      resumeDescription(
        "Le produit de 75 cl : 3,99 € (1 L = 5,32 €) Les 3 produits dont 1 OFFERT : 7,98 € (1 L = 3,55 €) au lieu de 11,97 € (1 L = 5,32 €) 12,5 % Vol",
      ),
    ).toBe("75 cl · 12,5 % Vol");
    expect(resumeDescription("8/9 parts. 300 g.Le kg : 56,53 €. Même promotion disponible sur d'autres produits")).toBe(
      "8/9 parts · 300 g",
    );
  });

  test("garde le reste tel quel", () => {
    expect(resumeDescription("6 x 33 cl (1.98 L).Le L : 2,32 €")).toBe("6 x 33 cl (1.98 L)");
    expect(resumeDescription("La bouteille de 1 L")).toBe("La bouteille de 1 L");
    expect(resumeDescription(null)).toBe("");
  });
});

describe("articleDepuisPromo", () => {
  test("nom du produit, et une note courte : où et combien", () => {
    const article = articleDepuisPromo(offre({ produit: "LAIT DEMI-ÉCRÉMÉ UHT", source: "leclerc", prix: 6.12 }));
    expect(article.nom).toBe("Lait demi-écrémé UHT");
    expect(simple(article.note)).toBe("Leclerc · 6,12 €");
  });

  test("sans prix, la réduction ; nom trop long raccourci", () => {
    const gamme = offre({ produit: "Tous les produits BIO", prix: null, reduction: "-34 %" });
    expect(simple(articleDepuisPromo(gamme).note)).toBe("Lidl · -34 %");
    expect(articleDepuisPromo(offre({ produit: "x".repeat(150) })).nom).toHaveLength(100);
  });
});

test("les notes des anciennes versions sont raccourcies à l'affichage", () => {
  expect(noteCourte("Promo Leclerc : 2,25 € · Jusqu'au samedi 7 novembre")).toBe("Leclerc · 2,25 €");
  expect(noteCourte("Promo Lidl : -34 % · À partir du jeudi 29 octobre")).toBe("Lidl · -34 %");
  expect(noteCourte("Leclerc · 0,99 € · jusqu'au 31 oct.")).toBe("Leclerc · 0,99 €");
  expect(noteCourte("Lidl · 1,29 € · dès le 29 oct.")).toBe("Lidl · 1,29 €");
  expect(noteCourte("sans lactose · grand format")).toBe("sans lactose · grand format");
  expect(noteCourte(undefined)).toBeUndefined();
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

  test("période de la promo, en court", () => {
    expect(simple(periode(offre({ date_fin: "2026-10-31" }), AUJOURDHUI))).toBe("Jusqu'au sam. 31 oct.");
    expect(simple(periode(offre({ date_fin: "2026-11-01" }), AUJOURDHUI))).toBe("Jusqu'au dim. 1er nov.");
    expect(periode(offre({ date_fin: "2026-10-28" }), AUJOURDHUI)).toBe("Jusqu'à demain");
    expect(periode(offre({ date_fin: AUJOURDHUI }), AUJOURDHUI)).toBe("Dernier jour");
    expect(simple(periode(offre({ date_debut: "2026-10-29" }), AUJOURDHUI))).toBe("Dès jeu. 29 oct.");
    expect(periode(offre({ date_debut: "2026-10-28" }), AUJOURDHUI)).toBe("Dès demain");
    expect(periode(offre({ date_debut: null, date_fin: null }), AUJOURDHUI)).toBe("");
  });

  test("période en court, sous l'étiquette d'un article (promo à venir)", () => {
    expect(simple(periodeCourte(offre({ date_fin: "2026-10-31" }), AUJOURDHUI))).toBe("jusqu'au 31 oct.");
    expect(simple(periodeCourte(offre({ date_debut: "2026-11-01", date_fin: "2026-11-07" }), AUJOURDHUI))).toBe(
      "dès le 1er nov.",
    );
    expect(periodeCourte(offre({ date_debut: null, date_fin: null }), AUJOURDHUI)).toBe("");
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
    expect(simple(recentes.info)).toBe("Promos : aujourd'hui à 5 h 48");
    expect(recentes.alerte).toBe("");
    expect(simple(phrasesFraicheur(new Date(2026, 9, 26, 5, 48).toISOString(), maintenant).alerte)).toBe(
      "Promos d'hier à 5 h 48 : elles ont pu changer.",
    );
    const anciennes = phrasesFraicheur(new Date(2026, 9, 24, 5, 48).toISOString(), maintenant);
    expect(simple(anciennes.info)).toBe("Promos : samedi 24 octobre à 5 h 48");
    expect(simple(anciennes.alerte)).toBe("Promos du samedi 24 octobre à 5 h 48 : elles ont pu changer.");
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

  test("prix au kilo, sauf s'il est égal au prix (vendu au kilo ou à la pièce)", () => {
    expect(simple(prixUnitaire(offre({ prix: 8.49, prix_unitaire: 9.43, unite: "kg" })))).toBe("9,43 €/kg");
    expect(prixUnitaire(offre({ prix: 0.79, prix_unitaire: 0.79, unite: "pièce" }))).toBeNull();
    expect(prixUnitaire(offre({ prix: 1.29, prix_unitaire: 1.29, unite: "kg" }))).toBeNull();
    expect(prixUnitaire(offre({ prix: 1 }))).toBeNull();
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
      "Promos E.Leclerc Geispolsheim pas à jour.",
    );
    expect(phraseSource({ nom: "Lidl Lingolsheim", etat: "partiel" })).toBe("Promos Lidl Lingolsheim incomplètes.");
  });
});
