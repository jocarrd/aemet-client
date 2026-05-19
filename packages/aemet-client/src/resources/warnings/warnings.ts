import { AemetError, AemetInvalidResponseError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import { parseCapXml } from "./cap.js";
import { gunzip, isGzip } from "./gzip.js";
import { parseTar } from "./tar.js";
import type { CapAreaCode, CapDocument } from "./types.js";

const AREA_RE = /^(esp|\d{2})$/;

export class WarningsResource extends Resource {
  async latest(area: CapAreaCode, options: RequestOptions = {}): Promise<CapDocument[]> {
    assertArea(area);
    const envelope = await this.transport.requestEnvelope(
      `/avisos_cap/ultimoelaborado/area/${area}`,
      options,
    );
    if (!envelope.datos) {
      throw new AemetInvalidResponseError("CAP envelope is missing `datos` URL.", {
        description: envelope.descripcion,
        status: envelope.estado,
      });
    }
    const response = await this.transport.fetchExternalRaw(envelope.datos, options.signal);
    if (!response.ok) {
      throw new AemetError(`CAP archive request failed with status ${response.status}.`, {
        endpoint: envelope.datos,
        status: response.status,
      });
    }
    const archive = new Uint8Array(await response.arrayBuffer());
    const tar = isGzip(archive) ? await gunzip(archive) : archive;
    const entries = parseTar(tar);
    const decoder = new TextDecoder("utf-8");
    const documents: CapDocument[] = [];
    for (const entry of entries) {
      if (entry.type !== "file" || !entry.name.toLowerCase().endsWith(".xml")) continue;
      const raw = decoder.decode(entry.content);
      documents.push({ filename: entry.name, raw, alert: parseCapXml(raw) });
    }
    return documents;
  }
}

function assertArea(area: string): void {
  if (!AREA_RE.test(area)) {
    throw new AemetError(
      `Invalid CAP area code: ${JSON.stringify(area)}. Expected "esp" or a 2-digit code.`,
    );
  }
}
