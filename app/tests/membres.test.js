import { describe, expect, test } from "vitest";

import { couleurDe, formaterAjout, nomDe, preparerFiche } from "../src/membres.js";

const A = "compte-a";
const B = "compte-b";

describe("couleurDe", () => {
  test("la couleur choisie, sinon une couleur donnée d'office, la même sur les deux téléphones", () => {
    expect(couleurDe(A, { [A]: { prenom: "A", couleur: "rose" } }, [A, B])).toBe("rose");
    expect(couleurDe(A, {}, [B, A])).toBe("vert");
    expect(couleurDe(B, {}, [A, B, B])).toBe("violet");
    expect(couleurDe(A, { [A]: { couleur: "inconnue" } }, [A])).toBe("vert");
  });
});

describe("nomDe", () => {
  test("le prénom, sinon « vous » ou « l'autre compte »", () => {
    expect(nomDe(A, { [A]: { prenom: "Camille" } }, B)).toBe("Camille");
    expect(nomDe(A, {}, A)).toBe("vous");
    expect(nomDe(B, {}, A)).toBe("l'autre compte");
  });
});

describe("preparerFiche", () => {
  test("nettoie le prénom et vérifie la couleur", () => {
    expect(preparerFiche({ prenom: "  Camille   Dupont ", couleur: "bleu" })).toEqual({
      fiche: { prenom: "Camille Dupont", couleur: "bleu" },
    });
    expect(preparerFiche({ prenom: " ", couleur: "bleu" }).erreur).toMatch(/prénom/);
    expect(preparerFiche({ prenom: "x".repeat(31), couleur: "bleu" }).erreur).toMatch(/trop long/);
    expect(preparerFiche({ prenom: "Camille", couleur: "noir" }).erreur).toMatch(/couleur/);
  });
});

describe("formaterAjout", () => {
  const maintenant = new Date(2026, 9, 27, 13, 40); // mardi 27 octobre

  test("aujourd'hui, hier, cette semaine, avant", () => {
    expect(formaterAjout(new Date(2026, 9, 27, 13, 38), maintenant)).toBe("13:38");
    expect(formaterAjout(new Date(2026, 9, 26, 8, 5), maintenant)).toBe("hier 08:05");
    expect(formaterAjout(new Date(2026, 9, 22, 9, 15), maintenant)).toBe("jeu. 09:15");
    expect(formaterAjout(new Date(2026, 9, 12, 9, 15), maintenant)).toBe("12/10 09:15");
  });

  test("pas de date : rien", () => {
    expect(formaterAjout(null, maintenant)).toBe("");
    expect(formaterAjout(new Date("x"), maintenant)).toBe("");
  });
});
