import { describe, expect, test } from "vitest";

import {
  TAILLE_MAX,
  assembler,
  decouper,
  dimensionsReduites,
  formaterTaille,
  libelleTicket,
  lireMontant,
  lireTicket,
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
  const saisie = { magasin: "autre", date: "2026-10-26", montant: "23,45", note: "  avec  la carte " };

  test("une fiche propre, prête à enregistrer", () => {
    expect(preparerTicket(saisie, AUJOURDHUI)).toEqual({
      fiche: { magasin: "autre", date_achat: "2026-10-26", montant: 23.45, note: "avec la carte" },
    });
    // Montant et note facultatifs.
    expect(preparerTicket({ ...saisie, montant: "", note: "" }, AUJOURDHUI)).toEqual({
      fiche: { magasin: "autre", date_achat: "2026-10-26" },
    });
  });

  test("magasin, date et montant vérifiés", () => {
    expect(preparerTicket({ ...saisie, magasin: "carrefour" }, AUJOURDHUI).erreur).toMatch(/magasin/);
    expect(preparerTicket({ ...saisie, magasin: "lidl" }, AUJOURDHUI).erreur).toMatch(/magasin/);
    expect(preparerTicket({ ...saisie, date: "" }, AUJOURDHUI).erreur).toMatch(/date/);
    expect(preparerTicket({ ...saisie, date: "2026-10-28" }, AUJOURDHUI).erreur).toMatch(/futur/);
    expect(preparerTicket({ ...saisie, montant: "beaucoup" }, AUJOURDHUI).erreur).toMatch(/Montant/);
    expect(preparerTicket({ ...saisie, montant: "20000" }, AUJOURDHUI).erreur).toMatch(/Montant/);
  });
});

describe("affichage des tickets", () => {
  const ticket = (id, date_achat, champs = {}) => ({ id, magasin: "leclerc", date_achat, ...champs });

  test("une ligne courte : magasin, jour, montant", () => {
    expect(simple(libelleTicket(ticket("a", "2026-10-27", { montant: 54.3 })))).toBe("Leclerc · mar. 27/10 · 54,30 €");
    expect(libelleTicket(ticket("b", "2026-10-05", { magasin: "autre" }))).toBe("Autre magasin · lun. 05/10");
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

describe("lireTicket : le total, la date et le magasin, lus sur le ticket", () => {
  test("ticket E.Leclerc (texte d'un PDF)", () => {
    const texte = `E.LECLERC GEISPOLSHEIM
LAIT DEMI ECREME 1L            1,78
PAIN COMPLET                   1,65
SOUS-TOTAL                    21,10
TOTAL REMISES                 -0,60
TOTAL A PAYER                 23,45 EUR
CB                            23,45
27/10/2026 18:42  CAISSE 012`;
    expect(lireTicket(texte, "2026-10-27")).toEqual({ magasin: "leclerc", date: "2026-10-27", montant: 23.45 });
  });

  test("ticket d'un autre magasin, lu sur une photo (fautes de lecture comprises)", () => {
    const texte = `SUPERMARCHE
Bananes 1,29 B
Beurre doux 1,99 B
TOTAI
12.34
CB EMV 12,34
26.10.26 18:05 1234`;
    expect(lireTicket(texte, "2026-10-27")).toEqual({ magasin: null, date: "2026-10-26", montant: 12.34 });
  });

  test("sans le mot « total » : la ligne de paiement ; rien de lisible : null", () => {
    expect(lireTicket("MAGASIN\nCARTE BANCAIRE   8,90 €", "2026-10-27")).toEqual({
      magasin: null,
      date: null,
      montant: 8.9,
    });
    expect(lireTicket("", "2026-10-27")).toEqual({ magasin: null, date: null, montant: null });
  });

  test("« À PAYER » seul est le total ; les lignes de TVA n'en sont pas", () => {
    const texte = `ARTICLES 12
MONTANT TVA 5,5 %   1,62
À PAYER             31,07
ESPECES             40,00
RENDU                8,93`;
    expect(lireTicket(texte, AUJOURDHUI).montant).toBe(31.07);
    expect(lireTicket("Montant HT 19,50\nMontant  23,40", AUJOURDHUI).montant).toBe(23.4);
  });

  test("les dates impossibles sont écartées : futures, trop anciennes, ou qui n'existent pas", () => {
    expect(lireTicket("Date 31/02/2026 puis 15/10/2026", "2026-10-27").date).toBe("2026-10-15");
    expect(lireTicket("Garantie jusqu'au 27/10/2028", "2026-10-27").date).toBeNull();
    expect(lireTicket("Ticket du 01/01/2020", "2026-10-27").date).toBeNull();
  });
});
