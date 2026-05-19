import { AemetError, AemetInvalidResponseError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import type { SatelliteImage, SatelliteProduct } from "./types.js";

const PRODUCT_RE = /^[a-z0-9]{2,12}$/i;

export class SatelliteResource extends Resource {
  async productUrl(
    product: SatelliteProduct,
    options: RequestOptions = {},
  ): Promise<{ url: string; metadataUrl?: string }> {
    assertProduct(product);
    const envelope = await this.transport.requestEnvelope(
      `/satelites/producto/${product}`,
      options,
    );
    if (!envelope.datos) {
      throw new AemetInvalidResponseError("Satellite envelope is missing `datos` URL.", {
        description: envelope.descripcion,
        status: envelope.estado,
      });
    }
    return envelope.metadatos
      ? { url: envelope.datos, metadataUrl: envelope.metadatos }
      : { url: envelope.datos };
  }

  async productImage(
    product: SatelliteProduct,
    options: RequestOptions = {},
  ): Promise<SatelliteImage> {
    const { url, metadataUrl } = await this.productUrl(product, options);
    const response = await this.transport.fetchExternalRaw(url, options.signal);
    if (!response.ok) {
      throw new AemetError(`Satellite image request failed with status ${response.status}.`, {
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

function assertProduct(product: string): void {
  if (!PRODUCT_RE.test(product)) {
    throw new AemetError(
      `Invalid satellite product: ${JSON.stringify(product)}. Expected 2-12 alphanumeric (e.g. "sat", "nubes", "irco").`,
    );
  }
}
