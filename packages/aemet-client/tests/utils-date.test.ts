import { describe, expect, it } from "vitest";
import { AemetError } from "../src/errors.js";
import { parseSpanishNumber, toAemetDate } from "../src/utils/date.js";

describe("toAemetDate", () => {
  it("formats a Date to AEMET's date string", () => {
    const d = new Date(Date.UTC(2026, 4, 17, 8, 15, 30));
    expect(toAemetDate(d)).toBe("2026-05-17T08:15:30UTC");
  });

  it("accepts a YYYY-MM-DD string", () => {
    expect(toAemetDate("2026-05-17")).toBe("2026-05-17T00:00:00UTC");
  });

  it("passes through an already-formatted AEMET date", () => {
    expect(toAemetDate("2026-05-17T08:15:30UTC")).toBe("2026-05-17T08:15:30UTC");
  });

  it("parses ISO strings", () => {
    expect(toAemetDate("2026-05-17T08:15:30Z")).toBe("2026-05-17T08:15:30UTC");
  });

  it("rejects invalid date inputs", () => {
    expect(() => toAemetDate("not-a-date")).toThrow(AemetError);
    expect(() => toAemetDate(new Date("invalid"))).toThrow(AemetError);
    expect(() => toAemetDate(123 as unknown as string)).toThrow(AemetError);
  });
});

describe("parseSpanishNumber", () => {
  it("parses comma decimals", () => {
    expect(parseSpanishNumber("5,2")).toBe(5.2);
    expect(parseSpanishNumber("0,0")).toBe(0);
    expect(parseSpanishNumber("-3,7")).toBe(-3.7);
  });

  it("parses integer strings", () => {
    expect(parseSpanishNumber("123")).toBe(123);
  });

  it("strips thousand separators", () => {
    expect(parseSpanishNumber("1.020,4")).toBe(1020.4);
  });

  it("returns undefined for empty or invalid input", () => {
    expect(parseSpanishNumber(undefined)).toBeUndefined();
    expect(parseSpanishNumber("")).toBeUndefined();
    expect(parseSpanishNumber("   ")).toBeUndefined();
    expect(parseSpanishNumber("abc")).toBeUndefined();
  });
});
