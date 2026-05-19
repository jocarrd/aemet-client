import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  AemetClient,
  MunicipalDailyForecast,
  MunicipalHourlyForecast,
} from "aemet-client";
import { ResolutionError, resolveMunicipality } from "../resolve.js";
import { errorContent } from "./shared.js";

const inputSchema = {
  location: z
    .string()
    .min(1)
    .describe(
      "Spanish municipality, either by name (e.g. 'Madrid', 'Logroño', 'A Coruña') or by 5-digit INE code (e.g. '28079').",
    ),
  days: z
    .number()
    .int()
    .min(1)
    .max(7)
    .optional()
    .describe("Daily forecasts: number of days to include (1-7, default 3). Ignored when granularity='hourly'."),
  granularity: z
    .enum(["daily", "hourly"])
    .optional()
    .describe(
      "'daily' (default) summarises up to 7 days. 'hourly' returns hour-by-hour values for the next ~40 hours.",
    ),
};

export function registerForecastTool(server: McpServer, client: AemetClient): void {
  server.registerTool(
    "get_forecast",
    {
      title: "Weather forecast for a Spanish municipality",
      description:
        "Returns the AEMET forecast for any of Spain's 8000+ municipalities. Accepts a name (with or without accents) or INE code. Daily granularity returns temperature min/max, sky state, precipitation probability and wind for each day. Hourly returns the next ~40h.",
      inputSchema,
    },
    async (args) => {
      const { location, days = 3, granularity = "daily" } = args;
      try {
        const municipality = resolveMunicipality(location);

        if (granularity === "hourly") {
          const [doc] = await client.prediction.municipalHourly(municipality.ineCode);
          if (!doc) {
            return errorContent(`AEMET returned no hourly data for ${municipality.name}.`);
          }
          return {
            content: [
              { type: "text", text: formatHourly(doc, municipality.name) },
            ],
          };
        }

        const [doc] = await client.prediction.municipalDaily(municipality.ineCode);
        if (!doc) {
          return errorContent(`AEMET returned no daily data for ${municipality.name}.`);
        }
        return {
          content: [{ type: "text", text: formatDaily(doc, municipality.name, days) }],
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

function formatDaily(doc: MunicipalDailyForecast, displayName: string, days: number): string {
  const slice = doc.prediccion.dia.slice(0, days);
  const header = `${displayName} (${doc.provincia}) — daily forecast issued ${doc.elaborado}\n`;
  const body = slice
    .map((day) => {
      const sky = primaryDescription(day.estadoCielo);
      const rainProb = primaryProbability(day.probPrecipitacion);
      const wind = day.viento[0];
      const lines = [
        `  ${day.fecha}`,
        `    Temp: min ${day.temperatura.minima}° / max ${day.temperatura.maxima}°`,
        `    Sky: ${sky ?? "n/a"}`,
        `    Rain probability: ${rainProb ?? "n/a"}`,
      ];
      if (wind) {
        lines.push(`    Wind: ${wind.direccion} at ${wind.velocidad} km/h`);
      }
      if (day.uvMax !== undefined) {
        lines.push(`    UV max: ${day.uvMax}`);
      }
      return lines.join("\n");
    })
    .join("\n");
  return header + body;
}

function formatHourly(doc: MunicipalHourlyForecast, displayName: string): string {
  const today = doc.prediccion.dia[0];
  if (!today) return `${displayName}: no hourly forecast available.`;
  const header = `${displayName} (${doc.provincia}) — hourly forecast issued ${doc.elaborado}\n  ${today.fecha}\n`;
  const hours = today.temperatura
    .slice(0, 12)
    .map((entry) => {
      const sky = today.estadoCielo.find((s) => s.periodo === entry.periodo)?.descripcion;
      const rain = today.probPrecipitacion.find((p) => p.periodo === entry.periodo)?.value;
      return `    ${entry.periodo}h  ${entry.value}°  ${sky ?? ""}${rain ? `  rain ${rain}%` : ""}`;
    })
    .join("\n");
  return header + hours;
}

function primaryDescription<T extends { descripcion?: string; periodo?: string }>(
  entries: T[],
): string | undefined {
  const day = entries.find((e) => e.periodo === "00-24") ?? entries[0];
  return day?.descripcion;
}

function primaryProbability(entries: Array<{ value: string; periodo?: string }>): string | undefined {
  const day = entries.find((e) => e.periodo === "00-24") ?? entries[0];
  return day ? `${day.value}%` : undefined;
}
