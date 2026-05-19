import { AemetClient, MemoryCacheAdapter } from "aemet-client";
import { findNearestMunicipality } from "aemet-client/data";

const aemet = new AemetClient({
  apiKey: process.env.AEMET_API_KEY!,
  cache: {
    adapter: new MemoryCacheAdapter({ maxEntries: 200 }),
    ttl: 600,
    keyPrefix: "example",
  },
});

const point = { lat: 42.4627, lon: -2.4449 };
const nearest = findNearestMunicipality(point);
if (!nearest) {
  console.error("No municipality near coordinates.");
  process.exit(1);
}

console.log(
  `Closest municipality to ${point.lat},${point.lon}: ${nearest.item.name} ` +
    `(INE ${nearest.item.ineCode}, ${nearest.distance.toFixed(1)} km)`,
);

const t0 = Date.now();
const [first] = await aemet.prediction.municipalDaily(nearest.item.ineCode);
console.log(`Cold fetch: ${Date.now() - t0} ms`);

const t1 = Date.now();
const [second] = await aemet.prediction.municipalDaily(nearest.item.ineCode);
console.log(`Cached fetch: ${Date.now() - t1} ms`);

const today = first?.prediccion.dia[0];
if (today) {
  console.log(
    `${nearest.item.name} — ${today.fecha}: ${today.temperatura.minima}° / ${today.temperatura.maxima}°`,
  );
}

void second;
