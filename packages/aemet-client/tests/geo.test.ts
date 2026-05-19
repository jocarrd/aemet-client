import { describe, expect, it } from "vitest";
import { AemetError } from "../src/errors.js";
import {
  findNearest,
  findNearestN,
  haversine,
  parseAemetCoordinate,
  type GeoPoint,
} from "../src/utils/geo.js";

describe("haversine", () => {
  it("returns 0 for identical points", () => {
    expect(haversine({ lat: 40, lon: -3 }, { lat: 40, lon: -3 })).toBeCloseTo(0, 4);
  });

  it("calculates Madrid → Barcelona to ~505 km", () => {
    const madrid = { lat: 40.4168, lon: -3.7038 };
    const barcelona = { lat: 41.3851, lon: 2.1734 };
    expect(haversine(madrid, barcelona)).toBeGreaterThan(495);
    expect(haversine(madrid, barcelona)).toBeLessThan(510);
  });

  it("is symmetric", () => {
    const a = { lat: 36.7213, lon: -4.4214 };
    const b = { lat: 43.3614, lon: -8.4115 };
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6);
  });

  it("handles antipodal points without NaN", () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: 180 };
    const d = haversine(a, b);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(20_000);
  });
});

describe("findNearest", () => {
  interface Station {
    id: string;
    lat: number;
    lon: number;
  }
  const stations: Station[] = [
    { id: "MAD", lat: 40.4168, lon: -3.7038 },
    { id: "BCN", lat: 41.3851, lon: 2.1734 },
    { id: "SVQ", lat: 37.3886, lon: -5.9823 },
  ];
  const target: GeoPoint = { lat: 40.0, lon: -4.0 };

  it("returns the closest item", () => {
    const result = findNearest(target, stations, (s) => ({ lat: s.lat, lon: s.lon }));
    expect(result?.item.id).toBe("MAD");
    expect(result?.distance).toBeGreaterThan(0);
  });

  it("returns undefined for empty list", () => {
    expect(findNearest(target, [], () => ({ lat: 0, lon: 0 }))).toBeUndefined();
  });

  it("skips items where getCoords returns null", () => {
    const items = [
      { id: "A", lat: 50, lon: 0 },
      { id: "B", lat: null as unknown as number, lon: null as unknown as number },
    ];
    const result = findNearest(target, items, (s) =>
      s.lat == null ? null : { lat: s.lat, lon: s.lon },
    );
    expect(result?.item.id).toBe("A");
  });
});

describe("findNearestN", () => {
  const items = [
    { id: "A", lat: 40, lon: -3 },
    { id: "B", lat: 41, lon: -3 },
    { id: "C", lat: 42, lon: -3 },
    { id: "D", lat: 50, lon: -3 },
  ];

  it("returns N closest sorted by distance", () => {
    const result = findNearestN({ lat: 40.2, lon: -3 }, items, (i) => i, 2);
    expect(result.map((r) => r.item.id)).toEqual(["A", "B"]);
    expect(result[0]!.distance).toBeLessThan(result[1]!.distance);
  });

  it("returns empty array for n=0", () => {
    expect(findNearestN({ lat: 0, lon: 0 }, items, (i) => i, 0)).toEqual([]);
  });
});

describe("parseAemetCoordinate", () => {
  it("parses Madrid Retiro latitude", () => {
    expect(parseAemetCoordinate("402411N")).toBeCloseTo(40.4030, 3);
  });

  it("parses negative longitudes (W)", () => {
    expect(parseAemetCoordinate("034041W")).toBeCloseTo(-3.6781, 3);
  });

  it("parses southern hemisphere (S)", () => {
    expect(parseAemetCoordinate("234156S")).toBeCloseTo(-23.6989, 3);
  });

  it("accepts lowercase hemisphere", () => {
    expect(parseAemetCoordinate("402411n")).toBeCloseTo(40.4030, 3);
  });

  it("rejects malformed values", () => {
    expect(() => parseAemetCoordinate("abc")).toThrow(AemetError);
    expect(() => parseAemetCoordinate("40N")).toThrow(AemetError);
    expect(() => parseAemetCoordinate("402411")).toThrow(AemetError);
  });
});
