import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  AemetClient,
  MountainForecast,
  MountainForecastDay,
  MountainForecastEntry,
} from "aemet-client";
import { ResolutionError } from "../resolve.js";
import { resolveMountainArea } from "../data/mountain-areas.js";
import { errorContent } from "./shared.js";

const inputSchema = {
  area: z
    .string()
    .min(1)
    .describe(
      "AEMET mountain area, either by name ('Picos de Europa', 'Pirineo Navarro', 'Sierra Nevada', 'Gredos') or by code 1-8.",
    ),
  period: z
    .number()
    .int()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Which AEMET period to read: 0 (default) is the first one, 1 the following one. With mode='past' it selects which already-issued day to retrieve.",
    ),
  mode: z
    .enum(["forecast", "past"])
    .optional()
    .describe(
      "'forecast' (default) returns the current forecast. 'past' returns a forecast AEMET issued earlier, useful to check what was expected.",
    ),
  days: z
    .number()
    .int()
    .min(1)
    .max(7)
    .optional()
    .describe("Number of days to include (1-7, default 3)."),
};

export function registerMountainTool(server: McpServer, client: AemetClient): void {
  server.registerTool(
    "get_mountain_forecast",
    {
      title: "Mountain area forecast for a Spanish range",
      description:
        "Returns the AEMET mountain forecast for one of Spain's 8 mountain areas (Picos de Europa, the three Pyrenean areas, Sierra de Madrid, Ibérica, Sierra Nevada, Béjar-Gredos). Built for mountaineering and skiing: sky state, precipitation, snow level, freezing level and wind and temperature broken down by altitude.",
      inputSchema,
    },
    async (args) => {
      const { area, period = 0, mode = "forecast", days = 3 } = args;
      try {
        const resolved = resolveMountainArea(area);
        const periodArg = period === 1 ? 1 : 0;
        const docs =
          mode === "past"
            ? await client.mountain.past(resolved.code, periodArg)
            : await client.mountain.forecast(resolved.code, periodArg);
        const [doc] = docs;
        if (!doc) {
          return errorContent(
            `AEMET returned no mountain data for ${resolved.name} (period ${periodArg}).`,
          );
        }
        return {
          content: [{ type: "text", text: format(doc, resolved.name, days) }],
        };
      } catch (err) {
        if (err instanceof ResolutionError) {
          return errorContent(err.message + (err.hint ? ` ${err.hint}` : ""));
        }
        throw err;
      }
    },
  );
}

function format(doc: MountainForecast, displayName: string, days: number): string {
  const label = doc.nombre?.trim() ? doc.nombre : displayName;
  const header = `${label} — mountain forecast issued ${doc.elaborado}\n`;
  const slice = doc.prediccion.dia.slice(0, days);
  if (slice.length === 0) return `${header}  No days in this period.`;
  return header + slice.map(formatDay).join("\n");
}

function formatDay(day: MountainForecastDay): string {
  const lines = [`  ${day.fecha}`];

  const sky = primary(day.estadoCielo);
  lines.push(`    Sky: ${sky?.descripcion ?? sky?.value ?? "n/a"}`);

  const rain = primary(day.precipitacion);
  const rainText = rain?.descripcion ?? rain?.value;
  if (rainText) lines.push(`    Precipitation: ${rainText}`);

  const snow = primary(day.cotaNieve) ?? primary(day.cotaNieveProv);
  if (snow?.value) lines.push(`    Snow level: ${snow.value} m`);

  const freezing = primary(day.isoCero);
  if (freezing?.value) lines.push(`    Freezing level (0°C): ${freezing.value} m`);

  const minusOne = primary(day.isoMenosUno);
  if (minusOne?.value) lines.push(`    -1°C level: ${minusOne.value} m`);

  const minusTen = primary(day.isoMenosDiez);
  if (minusTen?.value) lines.push(`    -10°C level: ${minusTen.value} m`);

  const temps = byAltitude(day.temperatura);
  if (temps) lines.push(`    Temperature: ${temps}`);

  const winds = formatWinds(day);
  if (winds) lines.push(`    Wind: ${winds}`);

  return lines.join("\n");
}

const WIND_LEVELS: Array<[keyof MountainForecastDay, string]> = [
  ["vientoSuperficie", "surface"],
  ["viento500m", "500 m"],
  ["viento1000m", "1000 m"],
  ["viento1500m", "1500 m"],
  ["viento2500m", "2500 m"],
  ["viento3000m", "3000 m"],
];

function formatWinds(day: MountainForecastDay): string | undefined {
  const parts: string[] = [];
  for (const [key, label] of WIND_LEVELS) {
    const entry = primary(day[key] as MountainForecastEntry[] | undefined);
    if (!entry) continue;
    const direction = entry.direccion ?? entry.descripcion;
    const speed = entry.velocidad ?? entry.value;
    if (!direction && !speed) continue;
    parts.push(`${label} ${[direction, speed ? `${speed} km/h` : ""].filter(Boolean).join(" ")}`);
  }
  return parts.length > 0 ? parts.join("; ") : undefined;
}

function byAltitude(entries: MountainForecastEntry[] | undefined): string | undefined {
  if (!entries || entries.length === 0) return undefined;
  const parts = entries
    .filter((e) => e.value !== undefined)
    .map((e) => (e.altitud ? `${e.altitud} m ${e.value}°` : `${e.value}°`));
  return parts.length > 0 ? parts.join(" / ") : undefined;
}

function primary(entries: MountainForecastEntry[] | undefined): MountainForecastEntry | undefined {
  if (!entries || entries.length === 0) return undefined;
  return entries.find((e) => e.periodo === "00-24") ?? entries[0];
}
