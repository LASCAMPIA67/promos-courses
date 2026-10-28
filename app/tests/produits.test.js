import { describe, expect, test } from "vitest";

import { promoChoisie, articleDepuisPromo, indexerPromos } from "../src/promos.js";
import {
  CHEZ_LECLERC,
  adressePhoto,
  articleDepuisProduit,
  cleMarque,
  indexerProduits,
  indexerProduitsPeuAPeu,
  indexerVignettes,
  phrasePrix,
  produitDe,
  produitDuCode,
  rechercherProduits,
} from "../src/produits.js";

const PHOTOS = "https://images.openfoodfacts.org/images/products/";
const BEAUTE = "https://images.openbeautyfacts.org/images/products/";
const BASES = { off: PHOTOS, obf: BEAUTE };
const COLONNES = ["ean", "nom", "marque", "quantite", "photo", "leclerc", "prix_habituel", "prix_vu_le"];

function produits(lignes) {
  return indexerProduits({ format: 1, photos: BASES, colonnes: COLONNES, produits: lignes });
}

const BASE = produits([
  ["3564700000229", "Brocolis surgelés", "Notre Jardin", "1 kg", "front_fr.9", 2, null, null],
  ["3017620422003", "Nutella", "Ferrero", "750 g", "front_fr.12", 1, 6.25, "2026-10-01"],
  ["7613035000000", "Arôme Maggi", "Maggi", "250 ml", "front_fr.3", 0, null, null],
  ["7613035000017", "Bouillon cube volaille", "Maggi", null, null, 0, null, null],
  ["3168930174271", "Chips nature", "Lay's", "150 g", "front_fr.2", 0, null, null],
  ["3600540000004", "Shampooing doux", "Dop", "400 ml", "obf:front_fr.3", 0, null, null],
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
    // La photo d'une base sœur (Open Beauty Facts) vient de son site.
    expect(produitDe(BASE, 5).photo).toBe(`${BEAUTE}360/054/000/0004/front_fr.3.200.jpg`);
  });

  test("garde tous les mots connus, rangés par longueur (pour les mots mal écrits)", () => {
    expect(BASE.mots.has("maggi")).toBe(true);
    expect(BASE.mots.has("nutella")).toBe(true);
    expect(BASE.vocabulaire.get(5)).toContain("maggi");
  });

  test("peu à peu : le même index, sans bloquer l'appli", async () => {
    const lignes = BASE.lignes;
    const index = await indexerProduitsPeuAPeu(
      { format: 1, photos: BASES, colonnes: COLONNES, produits: lignes },
      { parMorceau: 2 },
    );
    expect(index.cles).toEqual(BASE.cles);
  });

  test("lit aussi un fichier à une seule adresse de photos (celle d'Open Food Facts)", () => {
    const ancien = indexerProduits({ format: 1, photos: PHOTOS, colonnes: COLONNES, produits: BASE.lignes });
    expect(produitDe(ancien, 1).photo).toBe(`${PHOTOS}301/762/042/2003/front_fr.12.200.jpg`);
  });

  test("refuse un fichier d'un autre format", () => {
    expect(() => indexerProduits({ format: 2, produits: [] })).toThrow(/produits.json/);
    expect(() => indexerProduits(null)).toThrow();
  });
});

test("adressePhoto : le dossier vient du code-barres, le site du code de la base", () => {
  expect(adressePhoto(BASES, "3564700000229", "front_fr.9")).toBe(`${PHOTOS}356/470/000/0229/front_fr.9.200.jpg`);
  expect(adressePhoto(BASES, "12345678", "front.3")).toBe(`${PHOTOS}12345678/front.3.200.jpg`);
  expect(adressePhoto(BASES, "3600540000004", "obf:front_fr.3")).toBe(`${BEAUTE}360/054/000/0004/front_fr.3.200.jpg`);
  expect(adressePhoto(BASES, "3564700000229", "../../x")).toBeNull();
  expect(adressePhoto(BASES, "3564700000229", "inconnue:front_fr.9")).toBeNull();
  expect(adressePhoto({ off: "http://pas-sur/" }, "3564700000229", "front_fr.9")).toBeNull();
});

describe("rechercherProduits", () => {
  const noms = (resultats) => resultats.map(({ produit }) => produit.nom);

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

  test("dit pourquoi chaque produit est trouvé, pour le ranger parmi les promos", () => {
    const [arome, bouillon] = rechercherProduits(BASE, "maggi");
    expect(arome.proximite).toEqual({ parFamille: false, position: 1, exact: true });
    expect(bouillon.proximite).toEqual({ parFamille: false, position: Number.MAX_SAFE_INTEGER, exact: true });
  });

  test("un mot mal écrit : les mots connus qui lui ressemblent servent d'équivalents", () => {
    expect(rechercherProduits(BASE, "nutela")).toEqual([]);
    const approches = new Map([["nutela", [["nutella"]]]]);
    expect(noms(rechercherProduits(BASE, "nutela", { approches }))).toEqual(["Nutella"]);
  });
});

test("produitDuCode", () => {
  expect(produitDuCode(BASE, "3017620422003").nom).toBe("Nutella");
  expect(produitDuCode(BASE, "1111111111111")).toBeNull();
  expect(produitDuCode(null, "3017620422003")).toBeNull();
});

describe("indexerVignettes : les photos et logos des produits déjà vus en promo", () => {
  const ADRESSE = "https://raw.githubusercontent.com/LASCAMPIA67/promos-courses/photos/";
  test("garde les adresses sûres", () => {
    const vignettes = indexerVignettes({
      format: 1,
      adresse: ADRESSE,
      photos: { 3017620422003: `${"a".repeat(32)}.jpg`, 3000000000001: "../secret.jpg" },
      logos: { FERRERO: `logos/${"b".repeat(32)}.png`, AUTRE: "https://ailleurs/logo.png" },
      marque_repere: `logos/${"c".repeat(32)}.png`,
    });
    expect(vignettes.photos).toEqual(new Map([["3017620422003", `${ADRESSE}${"a".repeat(32)}.jpg`]]));
    expect(vignettes.logos).toEqual(new Map([["FERRERO", `${ADRESSE}logos/${"b".repeat(32)}.png`]]));
    expect(vignettes.marqueRepere).toBe(`${ADRESSE}logos/${"c".repeat(32)}.png`);
  });

  test("lit aussi un fichier à une seule adresse de photos (celle d'Open Food Facts)", () => {
    const ancien = indexerProduits({ format: 1, photos: PHOTOS, colonnes: COLONNES, produits: BASE.lignes });
    expect(produitDe(ancien, 1).photo).toBe(`${PHOTOS}301/762/042/2003/front_fr.12.200.jpg`);
  });

  test("refuse un fichier d'un autre format", () => {
    expect(() => indexerVignettes({ format: 2, adresse: ADRESSE })).toThrow(/vignettes.json/);
    expect(() => indexerVignettes({ format: 1, adresse: "http://pas-sur/" })).toThrow();
  });

  test("cleMarque : la marque écrite comme le robot la range", () => {
    expect(cleMarque("Côte d'Or")).toBe("COTE D OR");
    expect(cleMarque(null)).toBe("");
  });
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
