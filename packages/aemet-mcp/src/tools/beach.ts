import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  AemetClient,
  BeachForecast,
  BeachForecastDay,
  BeachMorningAfternoon,
} from "aemet-client";
import { AemetNotFoundError } from "aemet-client";
import { ResolutionError, normalize } from "../resolve.js";
import { BEACHES, type Beach } from "../data/beaches.js";
import { errorContent, resolutionErrorContent } from "./shared.js";

const inputSchema = {
  location: z
    .string()
    .min(1)
    .describe(
      "Beach name, with or without accents ('La Concha', 'Sant Joan', 'Playa de las Canteras'). Add the municipality after a comma when the name repeats ('La Concha, Suances'), or pass the 7-digit AEMET beach code ('3908503'). A coastal municipality name on its own lists its beaches.",
    ),
  municipality: z
    .string()
    .optional()
    .describe(
      "Municipality or province used to disambiguate beaches that share a name ('Suances', 'Cantabria').",
    ),
  days: z
    .number()
    .int()
    .min(1)
    .max(3)
    .optional()
    .describe("Number of days to include (1-3, default 3). AEMET publishes three days per beach."),
};

const MAX_CANDIDATES = 8;

const BEACH_WORDS = new Set([
  "playa",
  "playas",
  "platja",
  "platges",
  "praia",
  "praias",
  "hondartza",
]);
const LINK_WORDS = new Set(["de", "del", "dels", "d", "da", "do"]);
const ARTICLES = new Set(["la", "el", "las", "los", "les", "lo", "l", "a", "o"]);

export function registerBeachTool(server: McpServer, client: AemetClient): void {
  server.registerTool(
    "get_beach_forecast",
    {
      title: "Beach forecast for a Spanish beach",
      description:
        "Returns the AEMET beach forecast for the next three days: sky, wind and waves for morning and afternoon, plus maximum temperature, water temperature, thermal sensation and maximum UV index. Covers the 591 beaches AEMET forecasts during the bathing season. Accepts a beach name (accents optional), optionally narrowed by municipality, or the 7-digit AEMET beach code.",
      inputSchema,
    },
    async (args) => {
      const { location: query, municipality, days = 3 } = args;
      let resolved: Beach | undefined;
      try {
        resolved = resolveBeach(query, municipality);
        const [doc] = await client.beach.forecast(resolved.id);
        if (!doc) {
          return errorContent(`AEMET returned no beach forecast for ${resolved.name}.`);
        }
        return {
          content: [{ type: "text", text: formatBeach(doc, resolved, days) }],
        };
      } catch (err) {
        if (err instanceof ResolutionError) {
          return resolutionErrorContent(err);
        }
        if (err instanceof AemetNotFoundError && resolved) {
          return errorContent(
            `AEMET is not publishing a forecast for ${resolved.name} (${resolved.id}) right now. Beach forecasts are seasonal: they run from mid-May to mid-September.`,
          );
        }
        throw err;
      }
    },
  );
}

export function resolveBeach(input: string, scopeInput?: string): Beach {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ResolutionError("Empty beach", "Pass a beach name or a 7-digit AEMET beach code.");
  }

  if (/^\d{7}$/.test(trimmed)) {
    const found = BEACHES.find((b) => b.id === trimmed);
    if (!found) {
      throw new ResolutionError(
        `No beach with AEMET code "${trimmed}"`,
        "A beach code is the 5-digit INE municipality code plus a 2-digit beach number (e.g. 3908503 for La Concha, Suances).",
      );
    }
    return found;
  }

  const [firstPart, ...restParts] = trimmed.split(",");
  const name = (firstPart ?? "").trim();
  const scope = (scopeInput ?? "").trim() || restParts.join(",").trim();

  const pool = scope ? beachesIn(scope) : BEACHES;
  if (pool.length === 0) {
    throw new ResolutionError(
      `No AEMET beach belongs to "${scope}"`,
      "Use a coastal municipality ('Suances') or a coastal province ('Cantabria').",
    );
  }

  const matches = matchByName(pool, name);
  if (matches.length === 1) {
    return matches[0]!;
  }
  if (matches.length > 1) {
    throw new ResolutionError(
      ambiguityMessage(trimmed, matches),
      "Repeat with the 7-digit code, or add the municipality.",
    );
  }

  const byPlace = scope ? [] : beachesIn(name);
  if (byPlace.length === 1) {
    return byPlace[0]!;
  }
  if (byPlace.length > 1) {
    throw new ResolutionError(
      ambiguityMessage(trimmed, byPlace),
      "Repeat with one of the beach names above, or with its 7-digit code.",
    );
  }

  throw new ResolutionError(
    `No AEMET beach matches "${trimmed}"`,
    "AEMET forecasts 591 named beaches. Try the official beach name, its coastal municipality, or the 7-digit beach code.",
  );
}

function matchByName(pool: readonly Beach[], name: string): Beach[] {
  const variants = queryVariants(name);
  if (variants.length === 0) return [...pool];
  for (const query of variants) {
    const tiers = [
      pool.filter((b) => normalize(b.name) === query),
      pool.filter((b) => aliases(b.name).includes(query)),
      pool.filter((b) => normalize(b.name).startsWith(query)),
      pool.filter((b) => normalize(b.name).includes(query)),
    ];
    const hit = tiers.find((tier) => tier.length > 0);
    if (hit) return hit;
  }
  return [];
}

function queryVariants(name: string): string[] {
  const tokens = name
    .split(/\s+/)
    .map((token) => normalize(token))
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return [];

  const variants = [tokens.join("")];
  let start = 0;
  while (start < tokens.length - 1 && BEACH_WORDS.has(tokens[start]!)) start++;
  while (start < tokens.length - 1 && LINK_WORDS.has(tokens[start]!)) start++;
  variants.push(tokens.slice(start).join(""));

  while (
    start < tokens.length - 1 &&
    (ARTICLES.has(tokens[start]!) || LINK_WORDS.has(tokens[start]!))
  ) {
    start++;
  }
  variants.push(tokens.slice(start).join(""));

  return [...new Set(variants)];
}

function aliases(name: string): string[] {
  return name
    .split(/[/-]/)
    .map((part) => normalize(part))
    .filter((part) => part.length > 0);
}

function beachesIn(place: string): Beach[] {
  const target = normalize(place);
  if (!target) return [];
  const tiers = [
    BEACHES.filter((b) => normalize(b.municipality) === target),
    BEACHES.filter((b) => normalize(b.municipality).includes(target)),
    BEACHES.filter((b) => normalize(b.province).includes(target)),
  ];
  return tiers.find((tier) => tier.length > 0) ?? [];
}

function ambiguityMessage(input: string, matches: Beach[]): string {
  const shown = matches
    .slice(0, MAX_CANDIDATES)
    .map((b) => `  ${b.id}  ${b.name} — ${b.municipality}, ${b.province}`)
    .join("\n");
  const omitted = matches.length - MAX_CANDIDATES;
  const tail = omitted > 0 ? `\n  ...and ${omitted} more` : "";
  return `"${input}" matches ${matches.length} AEMET beaches:\n${shown}${tail}`;
}

function formatBeach(doc: BeachForecast, beach: Beach, days: number): string {
  const header = `${beach.name} (${beach.municipality}, ${beach.province}) — beach forecast issued ${doc.elaborado}\n`;
  const forecastDays = doc.prediccion.dia;
  if (forecastDays.length === 0) {
    return `${header}  AEMET returned no daily values.`;
  }
  return header + forecastDays.slice(0, days).map(formatDay).join("\n");
}

function formatDay(day: BeachForecastDay): string {
  const lines = [`  ${formatDate(day.fecha)}`];
  const sky = pairText(day.estadoCielo);
  if (sky) lines.push(`    Sky: ${sky}`);
  const wind = pairText(day.viento);
  if (wind) lines.push(`    Wind: ${wind}`);
  const waves = pairText(day.oleaje);
  if (waves) lines.push(`    Waves: ${waves}`);
  lines.push(`    Max temperature: ${day.tMaxima.valor1}°`);
  lines.push(`    Water temperature: ${day.tAgua.valor1}°`);
  const feelsLike = day.sTermica.descripcion1.trim();
  if (feelsLike) lines.push(`    Thermal sensation: ${feelsLike}`);
  lines.push(`    UV max: ${day.uvMax.valor1}`);
  return lines.join("\n");
}

function pairText(pair: BeachMorningAfternoon): string | undefined {
  const morning = pair.descripcion1.trim();
  const afternoon = pair.descripcion2.trim();
  if (!morning && !afternoon) return undefined;
  if (!morning) return `${afternoon} (afternoon)`;
  if (!afternoon || morning === afternoon) return morning;
  return `${morning} (morning) / ${afternoon} (afternoon)`;
}

function formatDate(value: number): string {
  const raw = String(value);
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  return compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : raw;
}
