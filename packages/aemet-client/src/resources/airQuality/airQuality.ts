import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import {
  POLLUTION_STATIONS,
  type PollutionMeasurement,
  type PollutionReading,
  type PollutionStation,
} from "./types.js";

const STATIONS = new Set<string>(Object.values(POLLUTION_STATIONS));
const LINE_RE = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})\s+(.*)$/;
const READING_RE =
  /([A-Za-z0-9]+)\((\d+)\):\s*([+-]?\d+(?:\.\d+)?)\s+(\S+)\s+CV:\s*(\S+)\s+FC:\s*(\S+)/g;

export class AirQualityResource extends Resource {
  async backgroundPollution(
    station: PollutionStation,
    options: RequestOptions = {},
  ): Promise<PollutionMeasurement[]> {
    return parseFinn(await this.backgroundPollutionRaw(station, options), String(station));
  }

  async backgroundPollutionRaw(
    station: PollutionStation,
    options: RequestOptions = {},
  ): Promise<string> {
    assertStation(station);
    const envelope = await this.transport.requestEnvelope(
      `/red/especial/contaminacionfondo/estacion/${station}`,
      options,
    );
    if (!envelope.datos) {
      throw new AemetError("Background pollution envelope is missing `datos` URL.", {
        description: envelope.descripcion,
        status: envelope.estado,
      });
    }
    const response = await this.transport.fetchExternalRaw(envelope.datos, options.signal);
    if (!response.ok) {
      throw new AemetError(`Background pollution download failed with status ${response.status}.`, {
        endpoint: envelope.datos,
        status: response.status,
      });
    }
    return decodeBody(response);
  }
}

async function decodeBody(response: Response): Promise<string> {
  const charset = (response.headers.get("content-type") ?? "")
    .match(/charset=([^;]+)/i)?.[1]
    ?.trim()
    .toLowerCase();
  if (!charset || charset === "utf-8" || charset === "utf8") return response.text();
  const bytes = new Uint8Array(await response.arrayBuffer());
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function parseFinn(text: string, station: string): PollutionMeasurement[] {
  const measurements: PollutionMeasurement[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = LINE_RE.exec(line.trim());
    if (!match) continue;
    const [, dd, mm, yyyy, hh, mi, rest] = match;
    measurements.push({
      station,
      timestamp: `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`,
      readings: parseReadings(rest ?? ""),
    });
  }
  return measurements;
}

function parseReadings(rest: string): PollutionReading[] {
  const readings: PollutionReading[] = [];
  READING_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = READING_RE.exec(rest)) !== null) {
    const [, parameter, code, value, unit, validity, factor] = match;
    const parsedFactor = Number(factor);
    readings.push({
      parameter: parameter ?? "",
      code: code ?? "",
      value: Number(value),
      unit: unit ?? "",
      validity: validity ?? "",
      ...(Number.isFinite(parsedFactor) ? { factor: parsedFactor } : {}),
    });
  }
  return readings;
}

function assertStation(station: string): void {
  if (!STATIONS.has(station)) {
    throw new AemetError(
      `Invalid pollution station: ${JSON.stringify(station)}. Expected one of ${[...STATIONS].join(", ")}.`,
    );
  }
}
