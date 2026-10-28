import { describe, expect, test } from "vitest";

import { approcher, decouper, ecartPermis, fautes, motsProches, rangerParLongueur } from "../src/ressemblance.js";

// Chaque mot connu, et dans combien de produits.
const CONNUS = new Map(
  ["nutella", "maggi", "magie", "coca", "cola", "chocolat", "lait", "laitue", "moutarde", "mali"].map((mot) => [
    mot,
    mot === "maggi" ? 40 : 1,
  ]),
);
const VOCABULAIRE = rangerParLongueur(CONNUS.keys());

describe("fautes", () => {
  test("lettre en trop, en moins, changée, ou deux lettres inversées : une faute chacune", () => {
    expect(fautes("nutela", "nutella")).toBe(1);
    expect(fautes("nutellla", "nutella")).toBe(1);
    expect(fautes("nutelka", "nutella")).toBe(1);
    expect(fautes("nuetlla", "nutella")).toBe(1);
    expect(fautes("lait", "lait")).toBe(0);
    expect(fautes("chcolta", "chocolat")).toBe(2);
  });

  test("s'arrête dès qu'il y en a trop", () => {
    expect(fautes("moutarde", "nutella", 2)).toBe(Infinity);
    expect(fautes("lait", "laitue", 1)).toBe(Infinity);
  });
});

test("ecartPermis : rien sous 4 lettres, une faute jusqu'à 6, deux au-delà", () => {
  expect(ecartPermis("the")).toBe(0);
  expect(ecartPermis("magi")).toBe(1);
  expect(ecartPermis("nutela")).toBe(1);
  expect(ecartPermis("chocolta")).toBe(2);
});

describe("motsProches", () => {
  test("le mot entier mal écrit, le plus proche d'abord", () => {
    expect(motsProches("nutela", VOCABULAIRE)).toEqual(["nutella"]);
    // À égalité de fautes, le plus courant d'abord ; sinon la longueur la plus proche.
    expect(motsProches("magi", VOCABULAIRE, { frequence: (mot) => CONNUS.get(mot) })).toEqual([
      "maggi",
      "mali",
      "magie",
    ]);
    expect(motsProches("magi", VOCABULAIRE)).toEqual(["mali", "maggi", "magie"]);
    expect(motsProches("moutrade", VOCABULAIRE)).toEqual(["moutarde"]);
  });

  test("ou son début, pendant qu'on écrit", () => {
    expect(motsProches("nutelz", VOCABULAIRE)).toEqual(["nutella"]);
  });

  test("rien pour un mot trop court ou sans ressemblance, ni pour le mot lui-même", () => {
    expect(motsProches("lai", VOCABULAIRE)).toEqual([]);
    expect(motsProches("brocoli", VOCABULAIRE)).toEqual([]);
    expect(motsProches("lait", VOCABULAIRE)).not.toContain("lait");
  });

  test("dans plusieurs listes de mots à la fois, sans doublon", () => {
    const promos = rangerParLongueur(["nutella", "nutelo"]);
    // À égalité de fautes, la longueur la plus proche d'abord.
    expect(motsProches("nutela", [VOCABULAIRE, promos])).toEqual(["nutelo", "nutella"]);
  });
});

test("decouper : un mot collé en deux mots connus", () => {
  expect(decouper("cocacola", CONNUS)).toEqual(["coca", "cola"]);
  expect(decouper("cocacola", [new Set(["coca"]), new Set(["cola"])])).toEqual(["coca", "cola"]);
  expect(decouper("nutella", CONNUS)).toBeNull();
});

test("approcher : pour chaque mot cherché, ses équivalents", () => {
  const approches = approcher(["arome", "magi", "cocacola"], [{ connus: CONNUS, vocabulaire: VOCABULAIRE }]);
  expect(approches.get("magi")).toEqual([["maggi"], ["mali"], ["magie"]]);
  expect(approches.get("cocacola")[0]).toEqual(["coca", "cola"]);
  expect(approches.has("arome")).toBe(false);
});
