import { describe, expect, test } from "vitest";

import { indexerPromos } from "../src/promos.js";
import { phraseResultats, rechercher } from "../src/recherche.js";

const AUJOURDHUI = "2026-10-28";

const offre = (id, produit, champs = {}) => ({
  id,
  source: "leclerc",
  magasin: "leclerc-geispolsheim",
  produit,
  prix: 1.5,
  date_debut: "2026-10-27",
  date_fin: "2026-11-07",
  ...champs,
});

const PROMOS = indexerPromos({
  format: 2,
  offres: [
    offre("lait", "LAIT DEMI-ÉCRÉMÉ", { marque: "CANDIA" }),
    offre("chocolat", "CHOCOLAT AU LAIT", { marque: "CÔTE D'OR" }),
    offre("nutella", "NUTELLA", { marque: "FERRERO" }),
    offre("arome", "ARÔME", { marque: "MAGGI" }),
    offre("magie", "BOÎTE DE MAGIE", { marque: "CLEMENTONI" }),
    offre("maggi", "BOUILLON KUB", { marque: "MAGGI" }),
  ],
});

const ids = ({ resultats }) => resultats.map(({ offre: o }) => o.id);
const chercher = (texte) => rechercher(texte, { promos: PROMOS, aujourdhui: AUJOURDHUI });

describe("rechercher : les promos, et celles qui ressemblent à un mot mal écrit", () => {
  test("ce qui correspond, les plus proches d'abord", () => {
    expect(chercher("lait")).toEqual({ resultats: expect.any(Array), ressemblants: false });
    expect(ids(chercher("lait"))).toEqual(["lait", "chocolat"]);
  });

  test("un mot mal écrit : les promos qui y ressemblent", () => {
    expect(chercher("nutela")).toMatchObject({ ressemblants: true });
    expect(ids(chercher("nutela"))).toEqual(["nutella"]);
    // « magi » est le début de « magie » mais pas avec « arome » : la marque la plus courante l'emporte.
    expect(ids(chercher("arome magi"))).toEqual(["arome"]);
  });

  test("rien du tout, ou pas encore de promos", () => {
    expect(chercher("zzzz")).toEqual({ resultats: [], ressemblants: false });
    expect(chercher("thé")).toEqual({ resultats: [], ressemblants: false }); // trop court pour une faute
    expect(rechercher("lait", { promos: null, aujourdhui: AUJOURDHUI })).toEqual({
      resultats: [],
      ressemblants: false,
    });
  });
});

test("phraseResultats", () => {
  const promo = { offre: {} };
  expect(phraseResultats([])).toBe("Aucune promo · + pour l'ajouter");
  expect(phraseResultats([promo])).toBe("1 promo");
  expect(phraseResultats([promo, promo, promo])).toBe("3 promos");
  expect(phraseResultats([promo, promo], { ressemblants: true, texte: " magi " })).toBe(
    "Rien pour « magi » · 2 promos qui ressemblent",
  );
  expect(phraseResultats([promo], { ressemblants: true, texte: "nutela" })).toBe(
    "Rien pour « nutela » · 1 promo qui ressemble",
  );
});
