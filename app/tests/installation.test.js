import { describe, expect, test } from "vitest";

import { estUnAppareilApple, proposerInstallation } from "../src/installation.js";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";
const IPAD_RECENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15";
const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36";

const JOUR = 24 * 3_600_000;

describe("estUnAppareilApple", () => {
  test("reconnaît l'iPhone, et l'iPad même quand il se présente comme un Mac", () => {
    expect(estUnAppareilApple(IPHONE)).toBe(true);
    expect(estUnAppareilApple(IPAD_RECENT, 5)).toBe(true);
    expect(estUnAppareilApple(IPAD_RECENT, 0)).toBe(false); // un vrai Mac
    expect(estUnAppareilApple(PC)).toBe(false);
  });
});

describe("proposerInstallation", () => {
  const maintenant = Date.parse("2026-10-27T10:00:00Z");

  test("dans Safari sur iPhone, pas encore installée : on propose", () => {
    expect(proposerInstallation({ userAgent: IPHONE, installee: false, maintenant })).toBe(true);
  });

  test("déjà installée, ou pas sur iPhone : on ne propose pas", () => {
    expect(proposerInstallation({ userAgent: IPHONE, installee: true, maintenant })).toBe(false);
    expect(proposerInstallation({ userAgent: PC, installee: false, maintenant })).toBe(false);
  });

  test("après « Plus tard », on attend 14 jours avant de reproposer", () => {
    const options = { userAgent: IPHONE, installee: false, maintenant };
    expect(proposerInstallation({ ...options, fermeLe: maintenant - 3 * JOUR })).toBe(false);
    expect(proposerInstallation({ ...options, fermeLe: maintenant - 15 * JOUR })).toBe(true);
  });
});
