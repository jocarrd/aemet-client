import { findNearest, findNearestN, type GeoPoint, type NearestMatch } from "../utils/geo.js";
import { MUNICIPALITIES } from "./municipalities.js";
import type { Municipality } from "./types.js";

export function findNearestMunicipality(target: GeoPoint): NearestMatch<Municipality> | undefined {
  return findNearest(target, MUNICIPALITIES, (m) => ({ lat: m.lat, lon: m.lon }));
}

export function findNearestMunicipalities(target: GeoPoint, n: number): NearestMatch<Municipality>[] {
  return findNearestN(target, MUNICIPALITIES, (m) => ({ lat: m.lat, lon: m.lon }), n);
}

export function findMunicipalityByCode(ineCode: string): Municipality | undefined {
  return MUNICIPALITIES.find((m) => m.ineCode === ineCode);
}

export function findMunicipalitiesByName(name: string, limit = 20): Municipality[] {
  const needle = normalize(name);
  if (!needle) return [];
  const results: Array<{ municipality: Municipality; score: number }> = [];
  for (const m of MUNICIPALITIES) {
    const haystack = normalize(m.name);
    if (haystack === needle) {
      results.push({ municipality: m, score: 3 });
      continue;
    }
    if (haystack.startsWith(needle)) {
      results.push({ municipality: m, score: 2 });
      continue;
    }
    if (haystack.includes(needle)) {
      results.push({ municipality: m, score: 1 });
    }
  }
  results.sort((a, b) => b.score - a.score || a.municipality.name.localeCompare(b.municipality.name));
  return results.slice(0, limit).map((r) => r.municipality);
}

export function findMunicipalitiesByProvince(provinceCode: string): Municipality[] {
  if (!/^\d{2}$/.test(provinceCode)) return [];
  return MUNICIPALITIES.filter((m) => m.ineCode.startsWith(provinceCode));
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
