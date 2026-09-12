import { AemetError, AemetInvalidResponseError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { toAemetDate, type AemetDateInput } from "../../utils/date.js";
import { Resource } from "../base.js";
import {
  SIGNIFICANT_MAP_AREAS,
  SIGNIFICANT_MAP_PERIODS,
  type MapImage,
  type SignificantMapArea,
  type SignificantMapPeriod,
} from "./types.js";

const AREAS = new Set<string>(Object.values(SIGNIFICANT_MAP_AREAS));
const PERIODS = new Set<string>(Object.values(SIGNIFICANT_MAP_PERIODS));

export class MapsResource extends Resource {
  async analysisUrl(options: RequestOptions = {}): Promise<{ url: string; metadataUrl?: string }> {
    return this.#fetchUrl("/mapasygraficos/analisis", options);
  }

  async analysisImage(options: RequestOptions = {}): Promise<MapImage> {
    return this.#fetchImage("/mapasygraficos/analisis", options);
  }

  async significantMapUrl(
    date: AemetDateInput,
    area: SignificantMapArea,
    period: SignificantMapPeriod,
    options: RequestOptions = {},
  ): Promise<{ url: string; metadataUrl?: string }> {
    return this.#fetchUrl(significantMapEndpoint(date, area, period), options);
  }

  async significantMapImage(
    date: AemetDateInput,
    area: SignificantMapArea,
    period: SignificantMapPeriod,
    options: RequestOptions = {},
  ): Promise<MapImage> {
    return this.#fetchImage(significantMapEndpoint(date, area, period), options);
  }

  async #fetchUrl(
    endpoint: string,
    options: RequestOptions,
  ): Promise<{ url: string; metadataUrl?: string }> {
    const envelope = await this.transport.requestEnvelope(endpoint, options);
    if (!envelope.datos) {
      throw new AemetInvalidResponseError("Map envelope is missing `datos` URL.", {
        description: envelope.descripcion,
        status: envelope.estado,
      });
    }
    return envelope.metadatos
      ? { url: envelope.datos, metadataUrl: envelope.metadatos }
      : { url: envelope.datos };
  }

  async #fetchImage(endpoint: string, options: RequestOptions): Promise<MapImage> {
    const { url, metadataUrl } = await this.#fetchUrl(endpoint, options);
    const response = await this.transport.fetchExternalRaw(url, options.signal);
    if (!response.ok) {
      throw new AemetError(`Map image request failed with status ${response.status}.`, {
        endpoint: url,
        status: response.status,
      });
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      url,
      ...(metadataUrl !== undefined ? { metadataUrl } : {}),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      bytes,
    };
  }
}

function significantMapEndpoint(
  date: AemetDateInput,
  area: SignificantMapArea,
  period: SignificantMapPeriod,
): string {
  const day = toAemetDate(date).slice(0, 10);
  assertArea(area);
  assertPeriod(period);
  return `/mapasygraficos/mapassignificativos/fecha/${day}/${area}/${period}`;
}

function assertArea(area: string): void {
  if (!AREAS.has(area)) {
    throw new AemetError(
      `Invalid map area: ${JSON.stringify(area)}. Expected one of ${[...AREAS].join(", ")}.`,
    );
  }
}

function assertPeriod(period: string): void {
  if (!PERIODS.has(period)) {
    throw new AemetError(
      `Invalid map period: ${JSON.stringify(period)}. Expected one of ${[...PERIODS].join(", ")}.`,
    );
  }
}
