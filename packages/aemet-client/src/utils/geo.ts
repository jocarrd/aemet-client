import { AemetError } from "../errors.js";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface NearestMatch<T> {
  item: T;
  distance: number;
}

const EARTH_RADIUS_KM = 6371;

export function haversine(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function findNearest<T>(
  target: GeoPoint,
  items: readonly T[],
  getCoords: (item: T) => GeoPoint | null | undefined,
): NearestMatch<T> | undefined {
  let best: NearestMatch<T> | undefined;
  for (const item of items) {
    const coords = getCoords(item);
    if (!coords) continue;
    const distance = haversine(target, coords);
    if (!best || distance < best.distance) best = { item, distance };
  }
  return best;
}

export function findNearestN<T>(
  target: GeoPoint,
  items: readonly T[],
  getCoords: (item: T) => GeoPoint | null | undefined,
  n: number,
): NearestMatch<T>[] {
  if (n <= 0) return [];
  const ranked: NearestMatch<T>[] = [];
  for (const item of items) {
    const coords = getCoords(item);
    if (!coords) continue;
    ranked.push({ item, distance: haversine(target, coords) });
  }
  ranked.sort((a, b) => a.distance - b.distance);
  return ranked.slice(0, n);
}

const AEMET_COORD_RE = /^(\d{2,3})(\d{2})(\d{2})([NSEWnsew])$/;

export function parseAemetCoordinate(value: string): number {
  const match = AEMET_COORD_RE.exec(value.trim());
  if (!match) {
    throw new AemetError(
      `Invalid AEMET coordinate: ${JSON.stringify(value)}. Expected DDMMSSx or DDDMMSSx (e.g. "402411N", "034041W").`,
    );
  }
  const [, deg, min, sec, hemi] = match;
  const decimal = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  const sign = hemi === "S" || hemi === "W" || hemi === "s" || hemi === "w" ? -1 : 1;
  return sign * decimal;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
