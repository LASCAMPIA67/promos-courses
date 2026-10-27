import { describe, expect, test } from "vitest";

import { AUTRES, RAYONS, cleRayon, rangerParRayon, rayonDe } from "../src/rayons.js";

const rayon = (nom, corrections) => rayonDe(nom, corrections).id;

describe("rayonDe : le rayon d'un article d'après son nom", () => {
  test("les articles courants", () => {
    expect(rayon("Bananes")).toBe("fruits-legumes");
    expect(rayon("Pommes de terre")).toBe("fruits-legumes");
    expect(rayon("Baguette")).toBe("boulangerie");
    expect(rayon("Pâtes")).toBe("epicerie-salee");
    expect(rayon("Tomato ketchup")).toBe("epicerie-salee");
    expect(rayon("Croûtons")).toBe("epicerie-salee");
    expect(rayon("Maggi")).toBe("epicerie-salee");
    expect(rayon("Café moulu")).toBe("epicerie-sucree");
    expect(rayon("Jus d'orange")).toBe("boissons");
    expect(rayon("Gel douche")).toBe("hygiene");
    expect(rayon("Lessive")).toBe("entretien");
    expect(rayon("Lait demi-écrémé UHT")).toBe("frais");
    expect(rayon("Crème")).toBe("frais");
    expect(rayon("Œufs")).toBe("frais");
    expect(rayon("Steak haché")).toBe("boucherie");
    expect(rayon("Frites")).toBe("surgeles");
  });

  test("le premier mot connu l'emporte, puis le terme le plus précis", () => {
    expect(rayon("Chocolat au lait")).toBe("epicerie-sucree");
    expect(rayon("Lait au chocolat")).toBe("frais");
    expect(rayon("Pain de mie complet")).toBe("boulangerie");
    expect(rayon("Pain d'épices")).toBe("epicerie-sucree");
    expect(rayon("Crème glacée vanille")).toBe("surgeles");
    expect(rayon("Crème hydratante")).toBe("hygiene");
    expect(rayon("Eau de javel")).toBe("entretien");
    expect(rayon("Pâte feuilletée")).toBe("frais");
    expect(rayon("Pâte à tartiner")).toBe("epicerie-sucree");
  });

  test("« surgelé », « bébé », « chat » ou « chien » décident, où qu'ils soient", () => {
    expect(rayon("Légumes surgelés")).toBe("surgeles");
    expect(rayon("Compote bébé")).toBe("bebe");
    expect(rayon("Pâtée pour chien")).toBe("animaux");
    expect(rayon("Croquettes chat")).toBe("animaux");
  });

  test("les marques des familles de produits vont avec leur famille", () => {
    expect(rayon("Pringles")).toBe("epicerie-salee");
    expect(rayon("Nutella")).toBe("epicerie-sucree");
    expect(rayon("Pampers")).toBe("bebe");
  });

  test("inconnu : « Autres » ; une correction du foyer l'emporte toujours", () => {
    expect(rayonDe("Ampoules de Noël multicolores xyz").id).toBe("entretien");
    expect(rayonDe("Truc bizarre")).toBe(AUTRES);
    expect(rayon("Maggi", { [cleRayon("maggi")]: "boissons" })).toBe("boissons");
    expect(cleRayon("  Tomato   KETCHUP ")).toBe("tomato ketchup");
  });
});

test("rangerParRayon : dans l'ordre du magasin, le frais et le surgelé à la fin, sans rayon vide", () => {
  const articles = ["Glace vanille", "Bananes", "Truc bizarre", "Lait", "Pâtes", "Pommes"].map((nom, i) => ({
    id: String(i),
    nom,
  }));
  const groupes = rangerParRayon(articles);
  expect(groupes.map(({ rayon: r }) => r.id)).toEqual([
    "fruits-legumes",
    "epicerie-salee",
    "frais",
    "surgeles",
    "autres",
  ]);
  expect(groupes[0].articles.map((a) => a.nom)).toEqual(["Bananes", "Pommes"]); // ordre d'ajout gardé
  expect(RAYONS.at(-1).id).toBe("surgeles");
});
