import { AemetClient } from "aemet-client";

const aemet = new AemetClient({ apiKey: process.env.AEMET_API_KEY! });

const target = { lat: 40.4168, lon: -3.7038 };
const stations = await aemet.observation.allStations();

const ranked = stations
  .map((s) => ({ station: s, distance: haversine(target, { lat: s.lat, lon: s.lon }) }))
  .sort((a, b) => a.distance - b.distance);

const nearest = ranked.slice(0, 3);
for (const { station, distance } of nearest) {
  console.log(`${station.ubi} (${station.idema}) — ${distance.toFixed(1)} km`);
  console.log(`  ${station.ta ?? "n/a"}°C, ${station.hr ?? "n/a"}% RH, ${station.vv ?? "n/a"} m/s`);
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
