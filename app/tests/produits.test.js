import { describe, expect, test } from "vitest";

import { promoChoisie, articleDepuisPromo, indexerPromos } from "../src/promos.js";
import {
  CHEZ_LECLERC,
  adressePhoto,
  articleDepuisProduit,
  indexerProduits,
  indexerProduitsPeuAPeu,
  phrasePrix,
  produitDe,
  produitDuCode,
  rechercherProduits,
} from "../src/produits.js";

const PHOTOS = "https://images.openfoodfacts.org/images/products/";
const COLONNES = ["ean", "nom", "marque", "quantite", "photo", "leclerc", "prix_habituel", "prix_vu_le"];

function produits(lignes) {
  return indexerProduits({ format: 1, photos: PHOTOS, colonnes: COLONNES, produits: lignes });
}

const BASE = produits([
  ["3564700000229", "Brocolis surgelés", "Notre Jardin", "1 kg", "front_fr.9", 2, null, null],
  ["3017620422003", "Nutella", "Ferrero", "750 g", "front_fr.12", 1, 6.25, "2026-10-01"],
  ["7613035000000", "Arôme Maggi", "Maggi", "250 ml", "front_fr.3", 0, null, null],
  ["7613035000017", "Bouillon cube volaille", "Maggi", null, null, 0, null, null],
  ["3168930174271", "Chips nature", "Lay's", "150 g", "front_fr.2", 0, null, null],
]);

describe("indexerProduits", () => {
  test("lit le fichier compact du robot", () => {
    expect(produitDe(BASE, 1)).toEqual({
      ean: "3017620422003",
      nom: "Nutella",
      marque: "Ferrero",
      quantite: "750 g",
      photo: `${PHOTOS}301/762/042/2003/front_fr.12.200.jpg`,
      leclerc: CHEZ_LECLERC.sur,
      prixHabituel: 6.25,
      prixVuLe: "2026-10-01",
    });
    expect(produitDe(BASE, 3).photo).toBeNull();
  });

  test("peu à peu : le même index, sans bloquer l'appli", async () => {
    const lignes = BASE.lignes;
    const index = await indexerProduitsPeuAPeu(
      { format: 1, photos: PHOTOS, colonnes: COLONNES, produits: lignes },
      { parMorceau: 2 },
    );
    expect(index.cles).toEqual(BASE.cles);
  });

  test("refuse un fichier d'un autre format", () => {
    expect(() => indexerProduits({ format: 2, produits: [] })).toThrow(/produits.json/);
    expect(() => indexerProduits(null)).toThrow();
  });
});

test("adressePhoto : le dossier d'Open Food Facts vient du code-barres", () => {
  expect(adressePhoto(PHOTOS, "3564700000229", "front_fr.9")).toBe(`${PHOTOS}356/470/000/0229/front_fr.9.200.jpg`);
  expect(adressePhoto(PHOTOS, "12345678", "front.3")).toBe(`${PHOTOS}12345678/front.3.200.jpg`);
  expect(adressePhoto(PHOTOS, "3564700000229", "../../x")).toBeNull();
  expect(adressePhoto("http://pas-sur/", "3564700000229", "front_fr.9")).toBeNull();
});

describe("rechercherProduits", () => {
  const noms = (resultats) => resultats.map((p) => p.nom);

  test("le début des mots suffit, la marque compte aussi, les plus proches d'abord", () => {
    expect(noms(rechercherProduits(BASE, "maggi"))).toEqual(["Arôme Maggi", "Bouillon cube volaille"]);
    expect(noms(rechercherProduits(BASE, "arom mag"))).toEqual(["Arôme Maggi"]);
    expect(noms(rechercherProduits(BASE, "nute"))).toEqual(["Nutella"]);
  });

  test("les familles de produits : « chips » trouve aussi ceux qui n'en portent pas le nom", () => {
    expect(noms(rechercherProduits(BASE, "chips"))).toEqual(["Chips nature"]);
  });

  test("sans ceux en promo, et rien sans texte", () => {
    expect(noms(rechercherProduits(BASE, "maggi", { exclure: new Set(["7613035000000"]) }))).toEqual([
      "Bouillon cube volaille",
    ]);
    expect(rechercherProduits(BASE, "")).toEqual([]);
    expect(rechercherProduits(null, "maggi")).toEqual([]);
  });
});

test("produitDuCode", () => {
  expect(produitDuCode(BASE, "3017620422003").nom).toBe("Nutella");
  expect(produitDuCode(BASE, "1111111111111")).toBeNull();
  expect(produitDuCode(null, "3017620422003")).toBeNull();
});

test("phrasePrix et articleDepuisProduit : le prix habituel quand un catalogue l'a donné", () => {
  const nutella = produitDe(BASE, 1);
  expect(phrasePrix(nutella)).toBe("Prix habituel 6,25 € (vu le 1er oct.)");
  expect(phrasePrix(produitDe(BASE, 2))).toBeNull();
  expect(articleDepuisProduit(nutella)).toEqual({
    nom: "Nutella",
    note: "Prix habituel 6,25 €",
    produit: "3017620422003",
  });
  expect(articleDepuisProduit(produitDe(BASE, 2))).toEqual({ nom: "Arôme Maggi", produit: "7613035000000" });
});

describe("un article venu d'un produit montre sa promo dès qu'il y en a une", () => {
  const offre = (id, champs) => ({
    id,
    source: "leclerc",
    magasin: "leclerc-geispolsheim",
    produit: "NUTELLA",
    marque: "FERRERO",
    prix: 4.99,
    ean: "3017620422003",
    date_debut: "2026-10-27",
    date_fin: "2026-11-07",
    ...champs,
  });
  const promos = indexerPromos({ format: 2, offres: [offre("a"), offre("b", { date_debut: "2026-11-03" })] });

  test("par son code-barres, même ajouté sans promo", () => {
    const article = { nom: "Nutella", produit: "3017620422003" };
    expect(promoChoisie(article, promos, "2026-10-28")).toEqual({ offre: promos[0].offre, aVenir: false });
    expect(promoChoisie(article, promos, "2026-11-20")).toBeNull(); // plus de promo : rien, pas « terminée »
  });

  test("ajouté depuis une promo : il garde le code-barres, et la promo suivante prend le relais", () => {
    expect(articleDepuisPromo(promos[0].offre)).toMatchObject({ promo: "a", produit: "3017620422003" });
    const article = { nom: "Nutella", promo: "a", produit: "3017620422003" };
    expect(promoChoisie(article, promos, "2026-10-28").offre.id).toBe("a");
    const terminee = { nom: "Nutella", promo: "ancienne", produit: "3017620422003" };
    expect(promoChoisie(terminee, promos, "2026-10-28").offre.id).toBe("a");
    expect(promoChoisie(terminee, promos, "2026-11-20")).toEqual({ terminee: true });
  });
});
