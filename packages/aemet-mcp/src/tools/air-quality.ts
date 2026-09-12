import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AemetClient, PollutionMeasurement, PollutionReading } from "aemet-client";
import { findNearest } from "aemet-client";
import { ResolutionError, normalize, resolveMunicipality } from "../resolve.js";
import { POLLUTION_STATION_TABLE, type PollutionStationInfo } from "../data/pollution-stations.js";
import { errorContent, resolutionErrorContent } from "./shared.js";

const inputSchema = {
  station: z
    .string()
    .optional()
    .describe(
      "Background station, by name ('Campisábalos', 'Doñana', 'Els Torms') or by its 2-digit AEMET code ('09'). Takes precedence over 'location' when both are given.",
    ),
  location: z
    .string()
    .optional()
    .describe(
      "Where to look from, when the station is unknown: a Spanish municipality name ('Madrid'), a 5-digit INE code ('28079') or a decimal coordinate pair ('40.4168,-3.7038'). The nearest background station is used, and the distance is reported.",
    ),
};

const COORD_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

const VALID_CODES = new Set(["V", "O", "J"]);

const PARAMETER_ORDER = [
  "O3",
  "NO2",
  "NO",
  "SO2",
  "PM10",
  "TEM",
  "HUM",
  "PRE",
  "VEL",
  "DIR",
  "RAD",
  "LLU",
];

const PARAMETER_LABELS: Record<string, string> = {
  O3: "O3 (ozone)",
  NO2: "NO2 (nitrogen dioxide)",
  NO: "NO (nitrogen monoxide)",
  SO2: "SO2 (sulphur dioxide)",
  PM10: "PM10 (particles under 10 µm)",
  TEM: "Temperature",
  HUM: "Relative humidity",
  PRE: "Pressure",
  VEL: "Wind speed",
  DIR: "Wind direction",
  RAD: "Global radiation",
  LLU: "Precipitation",
};

const UNIT_LABELS: Record<string, string> = {
  "ug/m3": "µg/m³",
  "W/m2": "W/m²",
  GRA: "°",
  GC: "°C",
};

const VALIDITY_LABELS: Record<string, string> = {
  V: "valid",
  O: "corrected",
  J: "calm",
  C: "disturbed by calibration",
  D: "technical failure",
  E: "electrical failure",
  F: "unknown failure",
  M: "disturbed by maintenance",
  P: "analyser out of service",
  Z: "disturbed by zero check",
};

interface ResolvedStation {
  station: PollutionStationInfo;
  from?: { label: string; distanceKm: number };
}

export function registerAirQualityTool(server: McpServer, client: AemetClient): void {
  server.registerTool(
    "get_air_quality",
    {
      title: "Background air pollution at an AEMET EMEP/VAG rural station",
      description:
        "Returns the latest reading of AEMET's background pollution network (EMEP/VAG/CAMP): 13 rural reference stations that measure the regional baseline of O3, NO, NO2, SO2 and PM10, plus temperature, humidity, pressure, wind, radiation and precipitation. This is BACKGROUND pollution, measured far from towns and roads on purpose. It does NOT answer 'how is the air in Madrid/Barcelona today': urban air quality is measured by the city and regional networks, not by AEMET, and this tool must not be used as a proxy for it.",
      inputSchema,
    },
    async (args) => {
      const { station, location } = args;
      try {
        const resolved = resolveStation(station, location);
        const measurements = await client.airQuality.backgroundPollution(resolved.station.code);
        const latest = latestMeasurement(measurements);
        if (!latest) {
          return errorContent(
            `AEMET returned no background pollution data for ${resolved.station.name} (${resolved.station.code}).`,
          );
        }
        return {
          content: [{ type: "text", text: format(latest, measurements, resolved) }],
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

export function resolveStation(station?: string, location?: string): ResolvedStation {
  const byStation = (station ?? "").trim();
  if (byStation) {
    return { station: matchStation(byStation) };
  }

  const byLocation = (location ?? "").trim();
  if (!byLocation) {
    throw new ResolutionError(
      "No station or location given",
      `Pass a background station ('Campisábalos', '09') or a location to search from ('Madrid'). Stations: ${stationList()}.`,
    );
  }

  const target = locationToPoint(byLocation);
  const nearest = findNearest(target.point, POLLUTION_STATION_TABLE, (s) => ({
    lat: s.lat,
    lon: s.lon,
  }));
  if (!nearest) {
    throw new ResolutionError("No background station found near that location");
  }
  return {
    station: nearest.item,
    from: { label: target.label, distanceKm: Math.round(nearest.distance) },
  };
}

function matchStation(input: string): PollutionStationInfo {
  if (/^\d{1,2}$/.test(input)) {
    const code = input.padStart(2, "0");
    const byCode = POLLUTION_STATION_TABLE.find((s) => s.code === code);
    if (!byCode) {
      throw new ResolutionError(
        `No AEMET background station with code "${input}"`,
        `Valid codes are ${POLLUTION_STATION_TABLE.map((s) => s.code).join(", ")}.`,
      );
    }
    return byCode;
  }

  const query = normalize(input);
  const tiers = [
    POLLUTION_STATION_TABLE.filter(
      (s) => normalize(s.name) === query || s.aliases.some((a) => normalize(a) === query),
    ),
    POLLUTION_STATION_TABLE.filter((s) => normalize(s.name).startsWith(query)),
    POLLUTION_STATION_TABLE.filter(
      (s) => normalize(s.name).includes(query) || normalize(s.province) === query,
    ),
  ];
  const hit = tiers.find((tier) => tier.length > 0);
  if (!hit || hit.length === 0) {
    throw new ResolutionError(
      `No AEMET background station matches "${input}"`,
      `The network has 13 rural stations: ${stationList()}. Pass a location instead to get the nearest one.`,
    );
  }
  if (hit.length > 1) {
    throw new ResolutionError(
      `"${input}" matches ${hit.length} background stations:\n${hit
        .map((s) => `  ${s.code}  ${s.name} — ${s.province}`)
        .join("\n")}`,
      "Repeat with the 2-digit code.",
    );
  }
  return hit[0]!;
}

interface TargetPoint {
  point: { lat: number; lon: number };
  label: string;
}

function locationToPoint(input: string): TargetPoint {
  const coords = COORD_PATTERN.exec(input);
  if (coords) {
    const lat = Number(coords[1]);
    const lon = Number(coords[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new ResolutionError("Coordinates must be finite numbers");
    }
    return { point: { lat, lon }, label: `${lat},${lon}` };
  }
  const municipality = resolveMunicipality(input);
  return {
    point: { lat: municipality.lat, lon: municipality.lon },
    label: municipality.name,
  };
}

function stationList(): string {
  return POLLUTION_STATION_TABLE.map((s) => `${s.name} (${s.code})`).join(", ");
}

function latestMeasurement(
  measurements: readonly PollutionMeasurement[],
): PollutionMeasurement | undefined {
  return [...measurements].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).at(-1);
}

function format(
  latest: PollutionMeasurement,
  measurements: readonly PollutionMeasurement[],
  resolved: ResolvedStation,
): string {
  const { station, from } = resolved;
  const lines = [
    `${station.name} (${station.province}) — AEMET background pollution station ${station.code}`,
  ];
  if (from) {
    lines.push(`  Nearest background station to ${from.label}: ${from.distanceKm} km away.`);
  }
  lines.push(
    "  EMEP/VAG/CAMP rural reference network: regional background air, not urban air quality.",
  );
  lines.push(`  Measured at ${latest.timestamp} UTC`);

  const readings = sortReadings(latest.readings);
  if (readings.length === 0) {
    lines.push("    AEMET reported no values for this timestamp.");
  } else {
    for (const reading of readings) lines.push(`    ${formatReading(reading)}`);
  }

  const span = timeSpan(measurements);
  if (span) lines.push(`  File carries ${measurements.length} ten-minute samples (${span} UTC).`);
  return lines.join("\n");
}

function sortReadings(readings: readonly PollutionReading[]): PollutionReading[] {
  return [...readings].sort((a, b) => rank(a.parameter) - rank(b.parameter));
}

function rank(parameter: string): number {
  const index = PARAMETER_ORDER.indexOf(parameter.toUpperCase());
  return index === -1 ? PARAMETER_ORDER.length : index;
}

function formatReading(reading: PollutionReading): string {
  const label = PARAMETER_LABELS[reading.parameter.toUpperCase()] ?? reading.parameter;
  const unit = UNIT_LABELS[reading.unit] ?? reading.unit;
  const value = `${formatValue(reading.value)}${unit ? ` ${unit}` : ""}`;
  const code = reading.validity.toUpperCase();
  if (VALID_CODES.has(code)) {
    return `${label}: ${value}`;
  }
  const meaning = VALIDITY_LABELS[code] ?? "not valid";
  return `${label}: ${value} — flagged ${code} (${meaning}), do not report this value`;
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return String(Math.round(value * 100) / 100);
}

function timeSpan(measurements: readonly PollutionMeasurement[]): string | undefined {
  if (measurements.length < 2) return undefined;
  const stamps = [...measurements].map((m) => m.timestamp).sort();
  return `${stamps[0]} to ${stamps.at(-1)}`;
}
