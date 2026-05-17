import { AemetError, AemetInvalidResponseError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import type { RadarImage, RegionalRadarCode } from "./types.js";

const REGIONAL_RE = /^[a-z]{2}$/i;

export class RadarResource extends Resource {
  async nationalUrl(options: RequestOptions = {}): Promise<{ url: string; metadataUrl?: string }> {
    return this.#fetchUrl("/red/radar/nacional", options);
  }

  async regionalUrl(
    code: RegionalRadarCode,
    options: RequestOptions = {},
  ): Promise<{ url: string; metadataUrl?: string }> {
    assertRegional(code);
    return this.#fetchUrl(`/red/radar/regional/${code.toLowerCase()}`, options);
  }

  async nationalImage(options: RequestOptions = {}): Promise<RadarImage> {
    return this.#fetchImage("/red/radar/nacional", options);
  }

  async regionalImage(code: RegionalRadarCode, options: RequestOptions = {}): Promise<RadarImage> {
    assertRegional(code);
    return this.#fetchImage(`/red/radar/regional/${code.toLowerCase()}`, options);
  }

  async #fetchUrl(
    endpoint: string,
    options: RequestOptions,
  ): Promise<{ url: string; metadataUrl?: string }> {
    const envelope = await this.transport.requestEnvelope(endpoint, options);
    if (!envelope.datos) {
      throw new AemetInvalidResponseError("Radar envelope is missing `datos` URL.", {
        description: envelope.descripcion,
        status: envelope.estado,
      });
    }
    return envelope.metadatos
      ? { url: envelope.datos, metadataUrl: envelope.metadatos }
      : { url: envelope.datos };
  }

  async #fetchImage(endpoint: string, options: RequestOptions): Promise<RadarImage> {
    const { url, metadataUrl } = await this.#fetchUrl(endpoint, options);
    const response = await this.transport.fetchExternalRaw(url, options.signal);
    if (!response.ok) {
      throw new AemetError(`Radar image request failed with status ${response.status}.`, {
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

function assertRegional(code: string): void {
  if (!REGIONAL_RE.test(code)) {
    throw new AemetError(
      `Invalid regional radar code: ${JSON.stringify(code)}. Expected a 2-letter code (e.g. "vc", "ba").`,
    );
  }
}
