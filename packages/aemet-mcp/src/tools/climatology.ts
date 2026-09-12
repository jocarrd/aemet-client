import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  AemetClient,
  ClimatologyDaily,
  ClimatologyNormal,
  GeoPoint,
  StationInventoryEntry,
} from "aemet-client";
import { findNearest, parseAemetCoordinate, parseSpanishNumber } from "aemet-client";
import { ResolutionError, resolveMunicipality, resolveMunicipalityByCoords } from "../resolve.js";
import { errorContent, textContent } from "./shared.js";

const MAX_DAILY_ROWS = 31;
const MAX_RANGE_DAYS = 186;
const DAY_MS = 24 * 60 * 60 * 1000;
const COORD_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const inputSchema = {
  location: z
    .string()
    .min(1)
    .describe(
      "Where to look. Accepts a Spanish municipality name ('Madrid'), 5-digit INE code ('28079'), or a decimal coordinate pair ('40.4168,-3.7038').",
    ),
  mode: z
    .enum(["range", "normals"])
    .optional()
    .describe(
      "'range' (default) returns observed daily records between `from` and `to`. 'normals' returns the station's long-term monthly averages and ignores the dates.",
    ),
  from: z
    .string()
    .regex(DATE_PATTERN)
    .optional()
    .describe("Start date as YYYY-MM-DD. Required when mode='range'."),
  to: z
    .string()
    .regex(DATE_PATTERN)
    .optional()
    .describe("End date as YYYY-MM-DD. Defaults to today when mode='range'."),
};

export function registerClimatologyTool(server: McpServer, client: AemetClient): void {
  server.registerTool(
    "get_climate_history",
    {
      title: "Historical climate records from the nearest AEMET climatological station",
      description:
        "Finds the AEMET climatological station closest to the requested location and returns its measured history. mode='range' returns daily records (temperature, precipitation, wind, humidity, sunshine) between two dates; AEMET serves at most 6 months (186 days) per call, so longer histories need several calls. Ranges longer than 31 days are condensed into one line per month (mean max/min, total precipitation, rainy days, extremes) instead of one line per day. mode='normals' returns the station's long-term monthly averages. Use this for past weather and climate questions, not for forecasts.",
      inputSchema,
    },
    async (args) => {
      const { location, mode = "range", from, to } = args;
      try {
        const target = locationToPoint(location);
        const inventory = await client.climatology.stationInventory();
        const nearest = findNearest(target.point, inventory, stationCoords);
        if (!nearest) {
          return errorContent("AEMET returned no climatological station inventory.");
        }
        const station = nearest.item;
        const header = formatStationHeader(station, nearest.distance, target.label);

        if (mode === "normals") {
          const normals = await client.climatology.normals(station.indicativo);
          if (normals.length === 0) {
            return errorContent(
              `AEMET has no climate normals for station ${station.nombre} (${station.indicativo}).`,
            );
          }
          return textContent(`${header}\n${formatNormals(normals)}`);
        }

        if (!from) {
          return errorContent(
            "mode='range' needs a start date. Pass from='YYYY-MM-DD' (and optionally to='YYYY-MM-DD'), or call again with mode='normals'.",
          );
        }
        const end = to ?? todayIso();
        const rangeError = validateRange(from, end);
        if (rangeError) {
          return errorContent(rangeError);
        }

        const records = await client.climatology.daily(station.indicativo, from, end);
        if (records.length === 0) {
          return errorContent(
            `AEMET returned no daily records for ${station.nombre} (${station.indicativo}) between ${from} and ${end}.`,
          );
        }
        return textContent(`${header}\n${formatRange(records, from, end)}`);
      } catch (err) {
        if (err instanceof ResolutionError) {
          return errorContent(err.message + (err.hint ? ` ${err.hint}` : ""));
        }
        throw err;
      }
    },
  );
}

interface TargetPoint {
  point: GeoPoint;
  label: string;
}

function locationToPoint(input: string): TargetPoint {
  const coordMatch = input.match(COORD_PATTERN);
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lon = Number(coordMatch[2]);
    const municipality = resolveMunicipalityByCoords(lat, lon);
    return {
      point: { lat, lon },
      label: `${lat.toFixed(4)},${lon.toFixed(4)} (near ${municipality.name})`,
    };
  }
  const municipality = resolveMunicipality(input);
  return {
    point: { lat: municipality.lat, lon: municipality.lon },
    label: municipality.name,
  };
}

function stationCoords(station: StationInventoryEntry): GeoPoint | undefined {
  try {
    return {
      lat: parseAemetCoordinate(station.latitud),
      lon: parseAemetCoordinate(station.longitud),
    };
  } catch {
    return undefined;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function validateRange(from: string, to: string): string | undefined {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start)) return `Invalid start date "${from}". Use YYYY-MM-DD.`;
  if (!Number.isFinite(end)) return `Invalid end date "${to}". Use YYYY-MM-DD.`;
  if (end < start) return `End date ${to} is before start date ${from}.`;
  if ((end - start) / DAY_MS > MAX_RANGE_DAYS) {
    return `AEMET serves at most 6 months (${MAX_RANGE_DAYS} days) of daily records per call, and ${from} to ${to} is longer. Split the range into shorter calls or use mode='normals'.`;
  }
  return undefined;
}

function formatStationHeader(
  station: StationInventoryEntry,
  distance: number,
  targetLabel: string,
): string {
  return [
    `Nearest climate station to ${targetLabel}: ${station.nombre} (${station.indicativo})`,
    `  Province: ${station.provincia}   Distance: ${distance.toFixed(1)} km   Altitude: ${station.altitud} m`,
  ].join("\n");
}

function formatRange(records: ClimatologyDaily[], from: string, to: string): string {
  if (records.length <= MAX_DAILY_ROWS) {
    const lines = records.map((record) => `    ${formatDay(record)}`);
    return [`  Daily records ${from} → ${to} (${records.length} days)`, ...lines].join("\n");
  }
  return formatMonthlySummary(records, from, to);
}

function formatDay(record: ClimatologyDaily): string {
  const parts = [record.fecha];
  const temps: string[] = [];
  const tmax = parseSpanishNumber(record.tmax);
  const tmin = parseSpanishNumber(record.tmin);
  const tmed = parseSpanishNumber(record.tmed);
  if (tmax !== undefined) temps.push(`max ${tmax.toFixed(1)}°C`);
  if (tmin !== undefined) temps.push(`min ${tmin.toFixed(1)}°C`);
  if (tmed !== undefined) temps.push(`mean ${tmed.toFixed(1)}°C`);
  if (temps.length > 0) parts.push(temps.join(" / "));

  const precip = parseSpanishNumber(record.prec);
  if (precip !== undefined) parts.push(`precip ${precip.toFixed(1)} mm`);
  else if (record.prec) parts.push(`precip ${record.prec}`);

  const wind = parseSpanishNumber(record.velmedia);
  const gust = parseSpanishNumber(record.racha);
  if (wind !== undefined) {
    parts.push(gust !== undefined ? `wind ${wind} m/s (gust ${gust} m/s)` : `wind ${wind} m/s`);
  }

  const humidity = parseSpanishNumber(record.hrMedia);
  if (humidity !== undefined) parts.push(`humidity ${humidity}%`);

  const sun = parseSpanishNumber(record.sol);
  if (sun !== undefined) parts.push(`sun ${sun.toFixed(1)} h`);

  return parts.join("   ");
}

interface MonthlyAggregate {
  month: string;
  days: number;
  maxSum: number;
  maxCount: number;
  minSum: number;
  minCount: number;
  precipTotal: number;
  precipDays: number;
  rainyDays: number;
  highest: number | undefined;
  lowest: number | undefined;
}

function formatMonthlySummary(records: ClimatologyDaily[], from: string, to: string): string {
  const months = aggregateByMonth(records);
  const header = `  ${records.length} daily records ${from} → ${to}, condensed to ${months.length} monthly summaries`;
  const lines = months.map((month) => `    ${formatMonth(month)}`);
  return [header, ...lines, `  ${formatPeriodTotals(months)}`].join("\n");
}

function aggregateByMonth(records: ClimatologyDaily[]): MonthlyAggregate[] {
  const byMonth = new Map<string, MonthlyAggregate>();
  for (const record of records) {
    const month = record.fecha.slice(0, 7);
    let entry = byMonth.get(month);
    if (!entry) {
      entry = {
        month,
        days: 0,
        maxSum: 0,
        maxCount: 0,
        minSum: 0,
        minCount: 0,
        precipTotal: 0,
        precipDays: 0,
        rainyDays: 0,
        highest: undefined,
        lowest: undefined,
      };
      byMonth.set(month, entry);
    }
    entry.days += 1;
    const tmax = parseSpanishNumber(record.tmax);
    if (tmax !== undefined) {
      entry.maxSum += tmax;
      entry.maxCount += 1;
      if (entry.highest === undefined || tmax > entry.highest) entry.highest = tmax;
    }
    const tmin = parseSpanishNumber(record.tmin);
    if (tmin !== undefined) {
      entry.minSum += tmin;
      entry.minCount += 1;
      if (entry.lowest === undefined || tmin < entry.lowest) entry.lowest = tmin;
    }
    const precip = parseSpanishNumber(record.prec);
    if (precip !== undefined) {
      entry.precipTotal += precip;
      entry.precipDays += 1;
      if (precip >= 1) entry.rainyDays += 1;
    }
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function formatMonth(month: MonthlyAggregate): string {
  const parts = [`${month.month} (${month.days} days)`];
  if (month.maxCount > 0) {
    parts.push(`mean max ${(month.maxSum / month.maxCount).toFixed(1)}°C`);
  }
  if (month.minCount > 0) {
    parts.push(`mean min ${(month.minSum / month.minCount).toFixed(1)}°C`);
  }
  if (month.highest !== undefined && month.lowest !== undefined) {
    parts.push(`extremes ${month.highest.toFixed(1)} / ${month.lowest.toFixed(1)}°C`);
  }
  if (month.precipDays > 0) {
    parts.push(`precip ${month.precipTotal.toFixed(1)} mm over ${month.rainyDays} rainy days`);
  }
  return parts.join("   ");
}

function formatPeriodTotals(months: MonthlyAggregate[]): string {
  let precipTotal = 0;
  let rainyDays = 0;
  let highest: number | undefined;
  let lowest: number | undefined;
  for (const month of months) {
    precipTotal += month.precipTotal;
    rainyDays += month.rainyDays;
    if (month.highest !== undefined && (highest === undefined || month.highest > highest)) {
      highest = month.highest;
    }
    if (month.lowest !== undefined && (lowest === undefined || month.lowest < lowest)) {
      lowest = month.lowest;
    }
  }
  const parts = [`Period totals: precip ${precipTotal.toFixed(1)} mm over ${rainyDays} rainy days`];
  if (highest !== undefined) parts.push(`highest max ${highest.toFixed(1)}°C`);
  if (lowest !== undefined) parts.push(`lowest min ${lowest.toFixed(1)}°C`);
  return parts.join("   ");
}

function formatNormals(normals: ClimatologyNormal[]): string {
  const sorted = [...normals].sort((a, b) => Number(a.mes) - Number(b.mes));
  const lines = sorted.map((entry) => `    ${formatNormal(entry)}`);
  return ["  Climate normals (long-term monthly averages)", ...lines].join("\n");
}

function formatNormal(entry: ClimatologyNormal): string {
  const label = monthLabel(entry.mes);
  const parts = [label];
  const mean = normalValue(entry, "tm_mes_md", "t_med");
  const meanMax = normalValue(entry, "tm_max_md");
  const meanMin = normalValue(entry, "tm_min_md");
  if (mean !== undefined) parts.push(`mean ${mean.toFixed(1)}°C`);
  if (meanMax !== undefined && meanMin !== undefined) {
    parts.push(`mean max ${meanMax.toFixed(1)}°C / mean min ${meanMin.toFixed(1)}°C`);
  }
  const absMax = normalValue(entry, "ta_max_md", "ta_max");
  const absMin = normalValue(entry, "ta_min_md", "ta_min");
  if (absMax !== undefined && absMin !== undefined) {
    parts.push(`record-average extremes ${absMax.toFixed(1)} / ${absMin.toFixed(1)}°C`);
  }
  const precip = normalValue(entry, "p_mes_md", "p_med");
  if (precip !== undefined) parts.push(`precip ${precip.toFixed(1)} mm`);
  const rainDays = normalValue(entry, "n_llu_md", "d_llu");
  if (rainDays !== undefined) parts.push(`rain days ${rainDays.toFixed(1)}`);
  const sun = normalValue(entry, "inso_md", "i_med");
  if (sun !== undefined) parts.push(`sun ${sun.toFixed(1)} h/day`);
  return parts.join("   ");
}

function monthLabel(mes: string): string {
  const index = Number(mes);
  if (index === 13) return "Year";
  return MONTH_NAMES[index - 1] ?? mes;
}

function normalValue(entry: ClimatologyNormal, ...keys: string[]): number | undefined {
  const record = entry as unknown as Record<string, string | undefined>;
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined) continue;
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    const value = Number(trimmed);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}
