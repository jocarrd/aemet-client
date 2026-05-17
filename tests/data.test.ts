import { describe, expect, it } from "vitest";
import {
  MUNICIPALITIES,
  findMunicipalitiesByName,
  findMunicipalitiesByProvince,
  findMunicipalityByCode,
  findNearestMunicipalities,
  findNearestMunicipality,
} from "../src/data/index.js";

describe("municipality dataset", () => {
  it("contains a non-trivial number of entries", () => {
    expect(MUNICIPALITIES.length).toBeGreaterThan(5000);
  });

  it("contains Madrid with the canonical INE code", () => {
    const madrid = findMunicipalityByCode("28079");
    expect(madrid?.name).toBe("Madrid");
    expect(madrid?.lat).toBeCloseTo(40.4168, 2);
    expect(madrid?.lon).toBeCloseTo(-3.7038, 2);
  });

  it("uses 5-digit INE codes everywhere", () => {
    for (const m of MUNICIPALITIES) {
      expect(m.ineCode).toMatch(/^\d{5}$/);
    }
  });

  it("returns undefined for unknown INE code", () => {
    expect(findMunicipalityByCode("99999")).toBeUndefined();
  });
});

describe("findNearestMunicipality", () => {
  it("resolves Madrid coords to Madrid", () => {
    const result = findNearestMunicipality({ lat: 40.4168, lon: -3.7038 });
    expect(result?.item.ineCode).toBe("28079");
    expect(result?.distance).toBeLessThan(1);
  });

  it("returns the closest match when target is between cities", () => {
    const result = findNearestMunicipality({ lat: 40.45, lon: -3.69 });
    expect(result?.item.name).toBeDefined();
    expect(result?.distance).toBeLessThan(15);
  });
});

describe("findNearestMunicipalities", () => {
  it("returns N entries sorted by distance", () => {
    const result = findNearestMunicipalities({ lat: 40.4168, lon: -3.7038 }, 5);
    expect(result).toHaveLength(5);
    expect(result[0]!.item.ineCode).toBe("28079");
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i]!.distance).toBeGreaterThanOrEqual(result[i - 1]!.distance);
    }
  });
});

describe("findMunicipalitiesByName", () => {
  it("finds an exact match first", () => {
    const result = findMunicipalitiesByName("Logroño");
    expect(result[0]?.name).toBe("Logroño");
  });

  it("is accent and case insensitive", () => {
    expect(findMunicipalitiesByName("logrono")[0]?.name).toBe("Logroño");
    expect(findMunicipalitiesByName("MADRID")[0]?.name).toBe("Madrid");
  });

  it("respects limit", () => {
    expect(findMunicipalitiesByName("santa", 3)).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    expect(findMunicipalitiesByName("")).toEqual([]);
    expect(findMunicipalitiesByName("   ")).toEqual([]);
  });

  it("returns substring matches when no prefix match", () => {
    const result = findMunicipalitiesByName("villa", 5);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("findMunicipalitiesByProvince", () => {
  it("returns municipalities in Madrid (28)", () => {
    const madrid = findMunicipalitiesByProvince("28");
    expect(madrid.length).toBeGreaterThan(50);
    expect(madrid.every((m) => m.ineCode.startsWith("28"))).toBe(true);
  });

  it("returns empty array for invalid province code", () => {
    expect(findMunicipalitiesByProvince("99")).toEqual([]);
    expect(findMunicipalitiesByProvince("abc")).toEqual([]);
  });
});
