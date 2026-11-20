import { describe, expect, it } from "vitest";
import { isPlaceholder } from "./types";

describe("isPlaceholder", () => {
  it("recognises every spelling srv/legal.js uses for an unfilled requisite", () => {
    for (const value of [
      "[TÖLDIRILSIN: töliq yuridik nomi]",
      "[TO'LDIRILSIN: STIR]",
      "[ZAPOLNIT: почтовый адрес, Узбекистан]",
      "[TO BE COMPLETED: full legal name]",
      "  [TÖLDIRILSIN: sana]",
    ]) {
      expect(isPlaceholder(value)).toBe(true);
    }
  });

  it("leaves real values alone", () => {
    for (const value of ["tijoratmarkazi@gmail.com", "+998 90 096 33 77", "Tijorat MChJ", "[Toshkent] filiali", ""]) {
      expect(isPlaceholder(value)).toBe(false);
    }
  });
});
