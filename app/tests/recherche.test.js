import { describe, expect, test } from "vitest";

import { indexerProduits } from "../src/produits.js";
import { indexerPromos } from "../src/promos.js";
import { phraseResultats, rechercherTout } from "../src/recherche.js";

const AUJOURDHUI = "2026-10-28";
const COLONNES = ["ean", "nom", "marque", "quantite", "photo", "leclerc", "prix_habituel", "prix_vu_le"];

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
    offre("lait", "LAIT DEMI-ÉCRÉMÉ", { marque: "CANDIA", ean: "3533630000001" }),
    offre("chocolat", "CHOCOLAT AU LAIT", { marque: "CÔTE D'OR", ean: "7622210000001" }),
    // Le nom du catalogue ne dit pas « pâte à tartiner » : son code-barres le relie au produit.
    offre("nutella", "NUTELLA", { marque: "FERRERO", ean: "3017620422003", date_debut: "2026-11-03" }),
    offre("finie", "LAIT ENTIER", { ean: "3428270000000", date_fin: "2026-10-20" }),
  ],
});

const PRODUITS = indexerProduits({
  format: 1,
  photos: { off: "https://images.openfoodfacts.org/images/products/" },
  colonnes: COLONNES,
  produits: [
    ["3533630000001", "Lait demi-écrémé", "Candia", "1 l", null, 1, null, null], // en promo
    ["3428270000000", "Lait entier", "Lactel", "1 l", null, 1, null, null], // sa promo est finie
    ["3017620422003", "Pâte à tartiner", "Nutella", "750 g", null, 1, null, null],
    ["7613035000000", "Arôme Maggi", "Maggi", "250 ml", null, 0, null, null],
    ["3000000000002", "Laitue", null, null, null, 0, null, null],
  ],
});

const nom = (resultat) => (resultat.offre ? `promo ${resultat.offre.id}` : resultat.produit.nom);
const chercher = (texte, produits = PRODUITS) =>
  rechercherTout(texte, { promos: PROMOS, produits, aujourdhui: AUJOURDHUI });

describe("rechercherTout : une seule liste, en promo ou non", () => {
  test("les plus proches d'abord ; à égalité, la promo d'abord ; un produit en promo une seule fois", () => {
    const { resultats, ressemblants } = chercher("lait");
    expect(resultats.map(nom)).toEqual(["promo lait", "Lait entier", "Laitue", "promo chocolat"]);
    expect(ressemblants).toBe(false);
  });

  test("un produit trouvé par son nom de la base montre sa promo, même à venir", () => {
    const [nutella] = chercher("pate a tartiner").resultats;
    expect(nutella).toMatchObject({ offre: { id: "nutella" }, aVenir: true });
  });

  test("sans tous les produits (pas encore chargés) : les promos seules", () => {
    expect(chercher("lait", null).resultats.map(nom)).toEqual(["promo lait", "promo chocolat"]);
  });

  test("un mot mal écrit : les produits qui y ressemblent", () => {
    const { resultats, ressemblants } = chercher("arome magi");
    expect(resultats.map(nom)).toEqual(["Arôme Maggi"]);
    expect(ressemblants).toBe(true);
    expect(chercher("nutela").resultats.map(nom)).toEqual(["promo nutella"]);
    expect(chercher("zzzz")).toEqual({ resultats: [], ressemblants: false });
  });
});

test("phraseResultats", () => {
  const promo = { offre: {} };
  const produit = { produit: {} };
  expect(phraseResultats([])).toBe("Aucun produit · + pour l'ajouter tel quel");
  expect(phraseResultats([produit])).toBe("1 produit");
  expect(phraseResultats([promo, produit, produit])).toBe("3 produits, dont 1 en promo");
  expect(phraseResultats([promo, promo])).toBe("2 produits en promo");
  expect(phraseResultats([produit, produit], { ressemblants: true, texte: " magi " })).toBe(
    "Rien pour « magi » · 2 produits qui ressemblent",
  );
  expect(phraseResultats([produit], { ressemblants: true, texte: "magi" })).toBe(
    "Rien pour « magi » · 1 produit qui ressemble",
  );
});
