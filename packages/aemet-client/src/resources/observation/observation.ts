import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import type { IdemaCode, StationObservation } from "./types.js";

const IDEMA_RE = /^[A-Z0-9]{3,6}$/i;

export class ObservationResource extends Resource {
  async allStations(options: RequestOptions = {}): Promise<StationObservation[]> {
    const { data } = await this.transport.request<StationObservation[]>(
      "/observacion/convencional/todas",
      options,
    );
    return data;
  }

  async station(idema: IdemaCode, options: RequestOptions = {}): Promise<StationObservation[]> {
    assertIdema(idema);
    const { data } = await this.transport.request<StationObservation[]>(
      `/observacion/convencional/datos/estacion/${idema}`,
      options,
    );
    return data;
  }
}

function assertIdema(idema: string): void {
  if (!IDEMA_RE.test(idema)) {
    throw new AemetError(
      `Invalid station idema: ${JSON.stringify(idema)}. Expected 3-6 alphanumeric characters, e.g. "1387".`,
    );
  }
}
