import { AemetError, AemetInvalidResponseError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { toAemetDate, type AemetDateInput } from "../../utils/date.js";
import { Resource } from "../base.js";
import type { MapImage, SignificantMapArea } from "./types.js";

const AREA_RE = /^[a-z]{1,4}$/i;
const DAY_RE = /^\d{1,2}$/;

export class MapsResource extends Resource {
  async analysisUrl(
    options: RequestOptions = {},
  ): Promise<{ url: string; metadataUrl?: string }> {
    return this.#fetchUrl("/mapasygraficos/analisis", options);
  }

  async analysisImage(options: RequestOptions = {}): Promise<MapImage> {
    return this.#fetchImage("/mapasygraficos/analisis", options);
  }

  async significantMapUrl(
    fechaElaboracion: AemetDateInput,
    area: SignificantMapArea,
    day: number | string,
    options: RequestOptions = {},
  ): Promise<{ url: string; metadataUrl?: string }> {
    const fechaStr = toAemetDate(fechaElaboracion);
    assertArea(area);
    const dayStr = assertDay(day);
    return this.#fetchUrl(
      `/mapasygraficos/mapasignificativo/fechaelaboracion/${fechaStr}/area/${area}/dia/${dayStr}`,
      options,
    );
  }

  async significantMapImage(
    fechaElaboracion: AemetDateInput,
    area: SignificantMapArea,
    day: number | string,
    options: RequestOptions = {},
  ): Promise<MapImage> {
    const fechaStr = toAemetDate(fechaElaboracion);
    assertArea(area);
    const dayStr = assertDay(day);
    return this.#fetchImage(
      `/mapasygraficos/mapasignificativo/fechaelaboracion/${fechaStr}/area/${area}/dia/${dayStr}`,
      options,
    );
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

function assertArea(area: string): void {
  if (!AREA_RE.test(area)) {
    throw new AemetError(
      `Invalid map area: ${JSON.stringify(area)}. Expected a short code (e.g. "esp", "a", "b").`,
    );
  }
}

function assertDay(day: number | string): string {
  const str = String(day);
  if (!DAY_RE.test(str)) {
    throw new AemetError(`Invalid day: ${JSON.stringify(day)}. Expected 1-2 digits (0-3 typical).`);
  }
  return str;
}
