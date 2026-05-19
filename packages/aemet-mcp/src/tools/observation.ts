import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AemetClient, StationObservation } from "aemet-client";
import { findNearest } from "aemet-client";
import {
  ResolutionError,
  resolveMunicipality,
  resolveMunicipalityByCoords,
} from "../resolve.js";
import { errorContent } from "./shared.js";

const inputSchema = {
  location: z
    .string()
    .min(1)
    .describe(
      "Where to observe. Accepts a Spanish municipality name ('Madrid'), 5-digit INE code ('28079'), or a decimal coordinate pair ('40.4168,-3.7038').",
    ),
};

const COORD_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

export function registerObservationTool(server: McpServer, client: AemetClient): void {
  server.registerTool(
    "get_nearest_observation",
    {
      title: "Latest real-time observation from the nearest AEMET weather station",
      description:
        "Finds the AEMET weather station closest to the requested location and returns its most recent reading (temperature, humidity, wind, precipitation, pressure). Useful for 'what's the weather right now' style questions.",
      inputSchema,
    },
    async (args) => {
      const { location } = args;
      try {
        const target = locationToPoint(location);
        const stations = await client.observation.allStations();
        const nearest = findNearest(target.point, stations, (s) => ({
          lat: s.lat,
          lon: s.lon,
        }));
        if (!nearest) {
          return errorContent("AEMET returned no station observations.");
        }
        return {
          content: [
            {
              type: "text",
              text: formatObservation(nearest.item, nearest.distance, target.label),
            },
          ],
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

interface TargetPoint {
  point: { lat: number; lon: number };
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

function formatObservation(
  station: StationObservation,
  distance: number,
  targetLabel: string,
): string {
  const lines = [
    `Nearest station to ${targetLabel}: ${station.ubi} (${station.idema})`,
    `  Distance: ${distance.toFixed(1)} km   Altitude: ${station.alt} m`,
    `  Last reading: ${station.fint}`,
  ];
  const fields: Array<[string, string]> = [];
  if (station.ta !== undefined) fields.push(["Temperature", `${station.ta}°C`]);
  if (station.hr !== undefined) fields.push(["Humidity", `${station.hr}%`]);
  if (station.prec !== undefined) fields.push(["Precipitation (last hour)", `${station.prec} mm`]);
  if (station.vv !== undefined) fields.push(["Wind speed", `${station.vv} m/s`]);
  if (station.dv !== undefined) fields.push(["Wind direction", `${station.dv}°`]);
  if (station.vmax !== undefined) fields.push(["Wind gust max", `${station.vmax} m/s`]);
  if (station.pres !== undefined) fields.push(["Pressure", `${station.pres} hPa`]);
  if (station.vis !== undefined) fields.push(["Visibility", `${station.vis} km`]);
  for (const [k, v] of fields) {
    lines.push(`  ${k}: ${v}`);
  }
  return lines.join("\n");
}
