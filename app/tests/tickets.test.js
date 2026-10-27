import { describe, expect, test } from "vitest";

import {
  TAILLE_MAX,
  assembler,
  decouper,
  devinerMagasin,
  dimensionsReduites,
  formaterTaille,
  libelleTicket,
  lireMontant,
  preparerTicket,
  regrouperParMois,
  trierTickets,
} from "../src/tickets.js";

// Les espaces insécables des nombres et des dates françaises deviennent de simples espaces.
const simple = (texte) => texte.replace(/[\u00a0\u202f]/g, " ");

const AUJOURDHUI = "2026-10-27";

describe("découper et recoller un fichier", () => {
  test("des morceaux d'au plus la taille demandée, recollés à l'identique", () => {
    const octets = Uint8Array.from({ length: 2500 }, (_, i) => i % 251);
    const morceaux = decouper(octets, 1000);
    expect(morceaux.map((m) => m.length)).toEqual([1000, 1000, 500]);
    expect(assembler(morceaux)).toEqual(octets);
  });

  test("un petit fichier tient en un morceau ; le plus gros fichier accepté, en six", () => {
    expect(decouper(new Uint8Array(10))).toHaveLength(1);
    expect(decouper(new Uint8Array(TAILLE_MAX))).toHaveLength(6);
  });
});

describe("lireMontant", () => {
  test("virgule ou point, avec ou sans « € »", () => {
    expect(lireMontant("54,30")).toBe(54.3);
    expect(lireMontant(" 54.3 € ")).toBe(54.3);
    expect(lireMontant("12")).toBe(12);
    expect(lireMontant("")).toBeNull();
    expect(lireMontant("douze")).toBeNaN();
    expect(lireMontant("1,234")).toBeNaN();
  });
});

describe("preparerTicket", () => {
  const saisie = { magasin: "lidl", date: "2026-10-26", montant: "23,45", note: "  avec  la carte " };

  test("une fiche propre, prête à enregistrer", () => {
    expect(preparerTicket(saisie, AUJOURDHUI)).toEqual({
      fiche: { magasin: "lidl", date_achat: "2026-10-26", montant: 23.45, note: "avec la carte" },
    });
    // Montant et note facultatifs.
    expect(preparerTicket({ ...saisie, montant: "", note: "" }, AUJOURDHUI)).toEqual({
      fiche: { magasin: "lidl", date_achat: "2026-10-26" },
    });
  });

  test("magasin, date et montant vérifiés", () => {
    expect(preparerTicket({ ...saisie, magasin: "carrefour" }, AUJOURDHUI).erreur).toMatch(/magasin/);
    expect(preparerTicket({ ...saisie, date: "" }, AUJOURDHUI).erreur).toMatch(/date/);
    expect(preparerTicket({ ...saisie, date: "2026-10-28" }, AUJOURDHUI).erreur).toMatch(/futur/);
    expect(preparerTicket({ ...saisie, montant: "beaucoup" }, AUJOURDHUI).erreur).toMatch(/Montant/);
    expect(preparerTicket({ ...saisie, montant: "20000" }, AUJOURDHUI).erreur).toMatch(/Montant/);
  });
});

test("le magasin deviné d'après le nom du fichier, sinon Leclerc", () => {
  expect(devinerMagasin("Ticket_LIDL_2026-10-27.pdf")).toBe("lidl");
  expect(devinerMagasin("ticket-leclerc.pdf")).toBe("leclerc");
  expect(devinerMagasin("IMG_1234.jpg")).toBe("leclerc");
});

describe("affichage des tickets", () => {
  const ticket = (id, date_achat, champs = {}) => ({ id, magasin: "leclerc", date_achat, ...champs });

  test("une ligne courte : magasin, jour, montant", () => {
    expect(simple(libelleTicket(ticket("a", "2026-10-27", { montant: 54.3 })))).toBe("Leclerc · mar. 27/10 · 54,30 €");
    expect(libelleTicket(ticket("b", "2026-10-05", { magasin: "lidl" }))).toBe("Lidl · lun. 05/10");
  });

  test("le plus récent d'abord, puis par mois", () => {
    const cree = (ms) => ({ toMillis: () => ms });
    const tickets = [
      ticket("ancien", "2026-09-30"),
      ticket("matin", "2026-10-27", { cree_le: cree(1) }),
      ticket("soir", "2026-10-27", { cree_le: cree(2) }),
      ticket("debut", "2026-10-01"),
    ];
    expect(trierTickets(tickets).map((t) => t.id)).toEqual(["soir", "matin", "debut", "ancien"]);
    expect(regrouperParMois(tickets).map(({ mois, tickets: liste }) => [mois, liste.length])).toEqual([
      ["Octobre 2026", 3],
      ["Septembre 2026", 1],
    ]);
  });

  test("taille d'une photo allégée, et taille d'un fichier", () => {
    expect(dimensionsReduites(3024, 4032)).toEqual({ largeur: 1400, hauteur: 1867 });
    expect(dimensionsReduites(1179, 8000)).toEqual({ largeur: 604, hauteur: 4096 });
    expect(dimensionsReduites(800, 600)).toEqual({ largeur: 800, hauteur: 600 });
    expect(formaterTaille(320_000)).toBe("313 Ko");
    expect(simple(formaterTaille(1_300_000))).toBe("1,2 Mo");
  });
});
