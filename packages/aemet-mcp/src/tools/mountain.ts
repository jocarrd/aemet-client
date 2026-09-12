import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AemetClient, MountainBulletin, MountainBulletinSection } from "aemet-client";
import { AemetNotFoundError } from "aemet-client";
import { ResolutionError } from "../resolve.js";
import { resolveMountainArea, type ResolvedMountainArea } from "../data/mountain-areas.js";
import { errorContent, textContent, resolutionErrorContent } from "./shared.js";

const inputSchema = {
  area: z
    .string()
    .min(1)
    .describe(
      "AEMET mountain area, by name ('Picos de Europa', 'Pirineo Aragonés', 'Sierra Nevada', 'Guadarrama', 'Gredos', 'Moncayo') or by code ('peu1', 'nav1', 'arn1', 'cat1', 'rio1', 'arn2', 'mad2', 'gre1', 'nev1'). Accents are optional.",
    ),
  mode: z
    .enum(["forecast", "past"])
    .optional()
    .describe(
      "'forecast' (default) returns the bulletin for the requested day. 'past' returns AEMET's summary of the last 24 hours and ignores `day`.",
    ),
  day: z
    .literal([0, 1, 2, 3])
    .optional()
    .describe(
      "Which forecast day to read: 0 (today, default) to 3. AEMET rejects day 4 and beyond. Ignored when mode='past'.",
    ),
};

const SECTION_TITLES: Record<string, string> = {
  prediccion: "Forecast",
  atmosferalibre: "Free atmosphere",
  sensacion_termica: "Temperature and thermal sensation by location",
  tiempo_pasado: "Observed weather",
};

const DAY_LABELS = ["today", "tomorrow", "in 2 days", "in 3 days"];

export function registerMountainTool(server: McpServer, client: AemetClient): void {
  server.registerTool(
    "get_mountain_forecast",
    {
      title: "Mountain bulletin for a Spanish mountain area",
      description:
        "Returns the AEMET mountain bulletin for one of Spain's nine mountain areas (Picos de Europa, the three Pyrenean areas, the two Iberian System areas, Guadarrama and Somosierra, Sierra de Gredos, Sierra Nevada). Written for mountaineers and skiers: sky state, precipitation, storms, temperature and wind as forecaster prose, plus the freezing and -10 °C levels, free-atmosphere winds at 1500 and 3000 m, and minimum and maximum temperatures with thermal sensation at named refuges, passes and resorts. mode='forecast' covers today (day 0) to day 3; mode='past' summarises the last 24 hours. These bulletins are year-round and cover the mountain range as a whole, so use them instead of get_forecast for anything above the valley floor.",
      inputSchema,
    },
    async (args) => {
      const { area, mode = "forecast", day = 0 } = args;
      let resolved: ResolvedMountainArea | undefined;
      try {
        resolved = resolveMountainArea(area);
        const [doc] =
          mode === "past"
            ? await client.mountain.past(resolved.code)
            : await client.mountain.forecast(resolved.code, day);
        if (!doc) {
          return errorContent(
            `AEMET returned no mountain bulletin for ${resolved.name} (${resolved.code}).`,
          );
        }
        return textContent(format(doc, resolved, mode, day));
      } catch (err) {
        if (err instanceof ResolutionError) {
          return resolutionErrorContent(err);
        }
        if (err instanceof AemetNotFoundError && resolved) {
          return errorContent(
            `AEMET is not publishing that mountain bulletin for ${resolved.name} (${resolved.code}) right now. Bulletins are reissued every morning; try day 0 or mode='past'.`,
          );
        }
        throw err;
      }
    },
  );
}

function format(
  doc: MountainBulletin,
  area: ResolvedMountainArea,
  mode: "forecast" | "past",
  day: number,
): string {
  const scope = mode === "past" ? "last 24 hours" : `day ${day} (${DAY_LABELS[day] ?? `+${day}`})`;
  const header = `${area.name} (${area.code}) — AEMET mountain bulletin, ${scope}`;
  const sections = doc.seccion.map(formatSection).filter((text) => text !== undefined);
  if (sections.length === 0) {
    return `${header}\n  AEMET returned an empty bulletin.`;
  }
  return [header, ...sections].join("\n");
}

function formatSection(section: MountainBulletinSection): string | undefined {
  const lines: string[] = [];

  for (const item of section.apartado) {
    const text = item.texto?.trim();
    if (!text) continue;
    const heading = item.cabecera?.trim();
    lines.push(heading ? `    ${heading}: ${text}` : `    ${text}`);
  }

  for (const place of section.lugar) {
    const line = formatPlace(place);
    if (line) lines.push(`    ${line}`);
  }

  const paragraphs = section.parrafo
    .map((entry) => entry.texto?.trim() ?? "")
    .filter((text, index, all) => text !== "" || (index > 0 && all[index - 1] !== ""));
  for (const paragraph of paragraphs) {
    lines.push(paragraph === "" ? "" : `    ${paragraph}`);
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  if (lines.length === 0) return undefined;

  const title = SECTION_TITLES[section.nombre] ?? section.nombre;
  return [`  ${title}`, ...lines].join("\n");
}

function formatPlace(place: Record<string, unknown>): string | undefined {
  const name = text(place["nombre"]);
  if (!name) return undefined;
  const altitude = text(place["altitud"]);
  const label = altitude ? `${name} (${altitude})` : name;

  const min = number(place["minima"]);
  const max = number(place["maxima"]);
  if (min === undefined && max === undefined) return label;

  const range = `${min ?? "?"} to ${max ?? "?"} °C`;
  const feltMin = number(place["stminima"]);
  const feltMax = number(place["stmaxima"]);
  if (feltMin === min && feltMax === max) {
    return `${label}: ${range}`;
  }
  return `${label}: ${range}, feels like ${feltMin ?? "?"} to ${feltMax ?? "?"} °C`;
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  return undefined;
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
