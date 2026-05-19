import { describe, expect, it } from "vitest";
import {
  ResolutionError,
  normalize,
  resolveCapArea,
  resolveMunicipality,
  resolveMunicipalityByCoords,
} from "../src/resolve.js";

describe("normalize", () => {
  it("strips accents and case", () => {
    expect(normalize("Logroño")).toBe("logrono");
    expect(normalize("A Coruña")).toBe("acoruna");
    expect(normalize("Castilla-La Mancha")).toBe("castillalamancha");
  });
});

describe("resolveMunicipality", () => {
  it("resolves a 5-digit INE code", () => {
    const m = resolveMunicipality("28079");
    expect(m.ineCode).toBe("28079");
    expect(m.name).toBe("Madrid");
    expect(m.matchedBy).toBe("ine");
  });

  it("rejects unknown INE codes with a hint", () => {
    expect(() => resolveMunicipality("99999")).toThrow(ResolutionError);
  });

  it("resolves by name (case + accent insensitive)", () => {
    const m = resolveMunicipality("logrono");
    expect(m.name).toBe("Logroño");
    expect(m.ineCode).toBe("26089");
    expect(m.matchedBy).toBe("name");
  });

  it("returns alternatives when name is ambiguous", () => {
    const m = resolveMunicipality("villanueva");
    expect(m.matchedBy).toBe("name");
    expect(m.alternatives).toBeDefined();
    expect(m.alternatives!.length).toBeGreaterThan(0);
  });

  it("throws on empty input", () => {
    expect(() => resolveMunicipality("")).toThrow(ResolutionError);
    expect(() => resolveMunicipality("   ")).toThrow(ResolutionError);
  });
});

describe("resolveMunicipalityByCoords", () => {
  it("finds the closest municipality to a point", () => {
    const m = resolveMunicipalityByCoords(40.4168, -3.7038);
    expect(m.matchedBy).toBe("coordinates");
    expect(m.name).toMatch(/madrid/i);
  });

  it("rejects non-finite coordinates", () => {
    expect(() => resolveMunicipalityByCoords(NaN, 0)).toThrow(ResolutionError);
  });
});

describe("resolveCapArea", () => {
  it("recognises 'esp'", () => {
    expect(resolveCapArea("esp").code).toBe("esp");
    expect(resolveCapArea("ESP").code).toBe("esp");
  });

  it("recognises 2-digit codes", () => {
    expect(resolveCapArea("73").key).toBe("laRioja");
    expect(resolveCapArea("69").key).toBe("cataluna");
  });

  it("recognises CCAA aliases with accents and variants", () => {
    expect(resolveCapArea("Cataluña").key).toBe("cataluna");
    expect(resolveCapArea("catalunya").key).toBe("cataluna");
    expect(resolveCapArea("Catalonia").key).toBe("cataluna");
    expect(resolveCapArea("La Rioja").key).toBe("laRioja");
    expect(resolveCapArea("rioja").key).toBe("laRioja");
    expect(resolveCapArea("Euskadi").key).toBe("paisVasco");
    expect(resolveCapArea("País Vasco").key).toBe("paisVasco");
    expect(resolveCapArea("Comunitat Valenciana").key).toBe("valencia");
  });

  it("throws for unknown areas", () => {
    expect(() => resolveCapArea("oz")).toThrow(ResolutionError);
    expect(() => resolveCapArea("99")).toThrow(ResolutionError);
    expect(() => resolveCapArea("")).toThrow(ResolutionError);
  });
});
