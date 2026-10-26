import { describe, expect, test } from "vitest";

import { cle, messageErreur, nettoyer, pluriel, preparerSaisie, trierArticles, trouverDoublon } from "../src/articles.js";

const date = (iso) => ({ toMillis: () => Date.parse(iso) });

describe("nettoyer et cle", () => {
  test("enlève les espaces en trop", () => {
    expect(nettoyer("  lait   demi  ")).toBe("lait demi");
    expect(nettoyer(undefined)).toBe("");
  });

  test("ignore majuscules, accents et ponctuation pour comparer", () => {
    expect(cle("Lait demi-écrémé")).toBe("lait demi ecreme");
    expect(cle("  CRÈME  fraîche ")).toBe(cle("creme fraiche"));
  });
});

describe("preparerSaisie", () => {
  test("nettoie et retire les champs vides", () => {
    expect(preparerSaisie({ nom: " Pain  complet ", quantite: " ", note: "" })).toEqual({
      article: { nom: "Pain complet" },
    });
    expect(preparerSaisie({ nom: "Lait", quantite: "2 L" })).toEqual({ article: { nom: "Lait", quantite: "2 L" } });
  });

  test("refuse un nom vide ou trop long", () => {
    expect(preparerSaisie({ nom: "   " }).erreur).toMatch(/nom/);
    expect(preparerSaisie({ nom: "x".repeat(101) }).erreur).toMatch(/trop long/);
    expect(preparerSaisie({ nom: "Lait", note: "x".repeat(201) }).erreur).toMatch(/note/);
  });
});

describe("trouverDoublon", () => {
  const articles = [
    { id: "1", nom: "Lait demi-écrémé", achete: false },
    { id: "2", nom: "Pain", achete: true },
  ];

  test("repère un article déjà à acheter, même écrit autrement", () => {
    expect(trouverDoublon(articles, "lait DEMI ecreme")?.id).toBe("1");
  });

  test("ignore les articles déjà dans le caddie et l'article qu'on modifie", () => {
    expect(trouverDoublon(articles, "pain")).toBeNull();
    expect(trouverDoublon(articles, "Lait demi-écrémé", "1")).toBeNull();
  });
});

describe("trierArticles", () => {
  test("à acheter : ordre d'ajout, les nouveaux non encore enregistrés à la fin", () => {
    const { aAcheter } = trierArticles([
      { id: "b", nom: "B", achete: false, cree_le: date("2026-10-26T10:00:00Z") },
      { id: "c", nom: "C", achete: false },
      { id: "a", nom: "A", achete: false, cree_le: date("2026-10-26T09:00:00Z") },
    ]);
    expect(aAcheter.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  test("dans le caddie : le dernier coché en haut", () => {
    const { dansLeCaddie } = trierArticles([
      { id: "x", achete: true, modifie_le: date("2026-10-26T10:00:00Z") },
      { id: "y", achete: true, modifie_le: date("2026-10-26T11:00:00Z") },
    ]);
    expect(dansLeCaddie.map((a) => a.id)).toEqual(["y", "x"]);
  });
});

describe("textes", () => {
  test("pluriel", () => {
    expect(pluriel(1, "article")).toBe("1 article");
    expect(pluriel(3, "article")).toBe("3 articles");
  });

  test("messages d'erreur en français", () => {
    expect(messageErreur({ code: "auth/invalid-credential" })).toBe("E-mail ou mot de passe incorrect.");
    expect(messageErreur({ code: "permission-denied" })).toMatch(/pas accès/);
    expect(messageErreur({ code: "firestore/permission-denied" })).toMatch(/pas accès/);
    expect(messageErreur(new Error("?"))).toMatch(/inattendue/);
  });
});
