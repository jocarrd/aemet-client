import { AemetClient } from "aemet-client";

const aemet = new AemetClient({ apiKey: process.env.AEMET_API_KEY! });

const forecast = await aemet.prediction.municipalDaily("28079");
const today = forecast[0]?.prediccion.dia[0];

if (!today) {
  console.error("No forecast data for today.");
  process.exit(1);
}

console.log(`Madrid — ${today.fecha}`);
console.log(`  Temperature: ${today.temperatura.minima}° / ${today.temperatura.maxima}°`);
console.log(`  Precipitation probability:`, today.probPrecipitacion);
console.log(`  UV max: ${today.uvMax ?? "n/a"}`);
