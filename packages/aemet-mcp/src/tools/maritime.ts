import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AemetClient, MaritimeForecast } from "aemet-client";
import { ResolutionError, normalize } from "../resolve.js";
import { MARITIME_AREAS, type MaritimeArea, type MaritimeProduct } from "../data/maritime-areas.js";
import { errorContent, resolutionErrorContent } from "./shared.js";

const inputSchema = {
  area: z
    .string()
    .min(1)
    .describe(
      "Sea area to forecast. Accepts the name people use ('Cantábrico', 'Golfo de Cádiz', 'Baleares', 'Canarias', 'Mediterráneo', 'Atlántico'), a coastal community or province ('Asturias', 'Málaga', 'Girona'), an AEMET high seas zone ('Gran Sol', 'Finisterre', 'Alborán'), or an AEMET area code: 0-2 for high seas, 40-47 for coastal waters.",
    ),
  product: z
    .enum(["coastal", "high_seas"])
    .optional()
    .describe(
      "Which AEMET product to read. 'coastal' covers Spanish coastal waters out to a few miles and carries warnings; 'high_seas' covers the open Atlantic and Mediterranean zones. Omit to pick the one that matches the area.",
    ),
};

interface MaritimeTextBlock {
  inicio?: string;
  fin?: string;
  texto?: string;
  nombre?: string;
}

interface MaritimeSubzone {
  nombre?: string;
  texto?: string;
}

interface MaritimeZone {
  nombre?: string;
  texto?: string;
  subzona?: MaritimeSubzone[];
}

interface MaritimeBulletin {
  origen?: { elaborado?: string };
  id?: string;
  nombre?: string;
  aviso?: MaritimeTextBlock;
  situacion?: MaritimeTextBlock;
  prediccion?: { inicio?: string; fin?: string; zona?: MaritimeZone[] };
  tendencia?: MaritimeTextBlock;
}

interface ResolvedMaritimeArea {
  area: MaritimeArea;
  zone?: string;
}

export function registerMaritimeTool(server: McpServer, client: AemetClient): void {
  server.registerTool(
    "get_maritime_forecast",
    {
      title: "Maritime forecast for Spanish coastal waters and high seas",
      description:
        "Returns the AEMET maritime bulletin for a sea area: sea state, wind, visibility, warnings and the validity period. Two products are covered: coastal waters (8 bulletins, one per stretch of the Spanish coast, each split into per-province zones and carrying the marine warnings) and high seas (3 bulletins covering the Atlantic north of 30N, the Atlantic south of 35N and the Mediterranean). Areas can be named the way people and the media name them, or given as AEMET codes.",
      inputSchema,
    },
    async (args) => {
      const { area, product } = args;
      try {
        const resolved = resolveMaritimeArea(area, product);
        const docs =
          resolved.area.product === "coastal"
            ? await client.maritime.coastal(resolved.area.code)
            : await client.maritime.highSeas(resolved.area.code);
        const bulletin = firstBulletin(docs);
        if (!bulletin) {
          return errorContent(
            `AEMET returned no maritime bulletin for ${resolved.area.name} (${labelFor(resolved.area)} area ${resolved.area.code}).`,
          );
        }
        return {
          content: [{ type: "text", text: formatBulletin(bulletin, resolved) }],
        };
      } catch (err) {
        if (err instanceof ResolutionError) {
          return resolutionErrorContent(err);
        }
        throw err;
      }
    },
  );
}

export function resolveMaritimeArea(
  input: string,
  product?: MaritimeProduct,
): ResolvedMaritimeArea {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ResolutionError(
      "Empty area",
      "Pass a sea area name ('Cantábrico', 'Baleares'), a coastal province, or an AEMET code (0-2 high seas, 40-47 coastal).",
    );
  }

  const pool = product ? MARITIME_AREAS.filter((a) => a.product === product) : MARITIME_AREAS;

  if (/^\d{1,2}$/.test(trimmed)) {
    const code = String(Number(trimmed));
    const byCode = pool.find((a) => a.code === code || a.code === trimmed);
    if (!byCode) {
      throw new ResolutionError(
        `No AEMET maritime area with code "${trimmed}"`,
        `Valid codes are ${codeList(pool)}.`,
      );
    }
    return { area: byCode };
  }

  const query = normalize(trimmed);
  const byAlias = pool.filter(
    (a) => normalize(a.name) === query || a.aliases.some((alias) => normalize(alias) === query),
  );
  if (byAlias.length === 1) {
    return { area: byAlias[0]! };
  }
  if (byAlias.length > 1) {
    throw new ResolutionError(
      `"${trimmed}" matches ${byAlias.length} AEMET maritime areas:\n${candidateList(byAlias)}`,
      "Repeat with the area code, or with the more precise name.",
    );
  }

  const ordered =
    product === "high_seas"
      ? pool
      : [...pool].sort((a, b) => Number(b.product === "coastal") - Number(a.product === "coastal"));
  for (const matcher of [zoneEquals, zoneStartsWith, zoneIncludes]) {
    for (const candidate of ordered) {
      const zone = candidate.zones.find((name) => matcher(normalize(name), query));
      if (zone) return { area: candidate, zone };
    }
  }

  throw new ResolutionError(
    `No AEMET maritime area matches "${trimmed}"`,
    `Known areas: ${candidateNames(pool)}. A coastal community or province works too ('Asturias', 'Málaga'), as does a high seas zone ('Gran Sol', 'Alborán').`,
  );
}

function zoneEquals(zone: string, query: string): boolean {
  return zone === query;
}

function zoneStartsWith(zone: string, query: string): boolean {
  return query.length >= 4 && zone.startsWith(query);
}

function zoneIncludes(zone: string, query: string): boolean {
  return query.length >= 4 && zone.includes(query);
}

function codeList(pool: readonly MaritimeArea[]): string {
  return pool.map((a) => a.code).join(", ");
}

function candidateNames(pool: readonly MaritimeArea[]): string {
  return pool.map((a) => `${a.name} (${a.code})`).join("; ");
}

function candidateList(matches: readonly MaritimeArea[]): string {
  return matches.map((a) => `  ${a.code}  ${a.name} — ${labelFor(a)}`).join("\n");
}

function labelFor(area: MaritimeArea): string {
  return area.product === "coastal" ? "coastal waters" : "high seas";
}

function firstBulletin(docs: MaritimeForecast): MaritimeBulletin | undefined {
  return (docs as unknown as MaritimeBulletin[])[0];
}

function formatBulletin(doc: MaritimeBulletin, resolved: ResolvedMaritimeArea): string {
  const { area, zone } = resolved;
  const lines = [
    `${area.name} — AEMET ${labelFor(area)} bulletin (area ${area.code}${doc.id ? `, ${doc.id}` : ""})`,
  ];
  const issued = doc.origen?.elaborado;
  const validity = period(doc.prediccion?.inicio, doc.prediccion?.fin);
  if (issued) lines.push(`  Issued: ${issued}`);
  if (validity) lines.push(`  Valid: ${validity}`);
  if (zone) lines.push(`  Matched zone: ${zone}`);

  const warning = text(doc.aviso);
  lines.push(`  Warnings: ${warning ?? "not issued with this bulletin"}`);

  const situation = text(doc.situacion);
  if (situation) lines.push(`  Situation: ${situation}`);

  const zones = orderZones(doc.prediccion?.zona ?? [], zone);
  if (zones.length === 0) {
    lines.push("  Zones: AEMET returned no zone forecasts.");
  } else {
    lines.push("  Zones (AEMET issues wind, sea state and visibility as one text per zone):");
    for (const entry of zones) lines.push(formatZone(entry));
  }

  const trend = text(doc.tendencia);
  if (trend) {
    const trendPeriod = period(doc.tendencia?.inicio, doc.tendencia?.fin);
    lines.push(`  Trend${trendPeriod ? ` (${trendPeriod})` : ""}: ${trend}`);
  }
  return lines.join("\n");
}

function orderZones(zones: readonly MaritimeZone[], matched?: string): MaritimeZone[] {
  if (!matched) return [...zones];
  const hit = zones.filter((z) => z.nombre === matched);
  return [...hit, ...zones.filter((z) => z.nombre !== matched)];
}

function formatZone(zone: MaritimeZone): string {
  const name = zone.nombre?.trim() ?? "Unnamed zone";
  const lines = [`    ${name}`];
  const own = collapse(zone.texto);
  if (own) lines.push(`      ${own}`);
  for (const sub of zone.subzona ?? []) {
    const subText = collapse(sub.texto);
    if (!subText) continue;
    const subName = sub.nombre?.trim();
    if (!subName || subName === name) {
      lines.push(`      ${subText}`);
    } else {
      lines.push(`      ${subName}: ${subText}`);
    }
  }
  return lines.join("\n");
}

function text(block: MaritimeTextBlock | undefined): string | undefined {
  return collapse(block?.texto);
}

function collapse(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\s+/g, " ");
}

function period(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;
  if (!end) return start;
  if (!start) return `until ${end}`;
  return `${start} to ${end}`;
}
