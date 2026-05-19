import { AemetClient, CAP_AREAS, type CapInfo } from "aemet-client";

const aemet = new AemetClient({ apiKey: process.env.AEMET_API_KEY! });

const documents = await aemet.warnings.latest(CAP_AREAS.cataluna);

for (const doc of documents) {
  const info = pickLanguage(doc.alert.info, "es-ES");
  if (!info) continue;
  console.log(`[${info.severity}] ${info.event}`);
  console.log(`  ${info.headline}`);
  console.log(`  effective: ${info.effective ?? "n/a"} → expires: ${info.expires ?? "n/a"}`);
  for (const area of info.area) {
    console.log(`  area: ${area.areaDesc}`);
  }
  console.log();
}

function pickLanguage(infos: CapInfo[], language: string): CapInfo | undefined {
  return infos.find((i) => i.language === language) ?? infos[0];
}
