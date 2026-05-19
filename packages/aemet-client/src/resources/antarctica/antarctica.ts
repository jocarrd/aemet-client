import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { toAemetDate, type AemetDateInput } from "../../utils/date.js";
import { Resource } from "../base.js";
import type { AntarcticaObservation, AntarcticaStation } from "./types.js";

const STATION_RE = /^[A-Z0-9]{3,6}$/i;

export class AntarcticaResource extends Resource {
  async observations(
    station: AntarcticaStation,
    from: AemetDateInput,
    to: AemetDateInput,
    options: RequestOptions = {},
  ): Promise<AntarcticaObservation[]> {
    assertStation(station);
    const fromStr = toAemetDate(from);
    const toStr = toAemetDate(to);
    assertRange(fromStr, toStr);
    const { data } = await this.transport.request<AntarcticaObservation[]>(
      `/antartida/datos/fechaini/${fromStr}/fechafin/${toStr}/estacion/${station}`,
      options,
    );
    return data;
  }
}

function assertStation(station: string): void {
  if (!STATION_RE.test(station)) {
    throw new AemetError(
      `Invalid Antarctic station: ${JSON.stringify(station)}. Expected 3-6 alphanumeric (e.g. "89064" Juan Carlos I, "89070" Gabriel de Castilla).`,
    );
  }
}

function assertRange(from: string, to: string): void {
  const fromDate = new Date(from.replace("UTC", "Z")).getTime();
  const toDate = new Date(to.replace("UTC", "Z")).getTime();
  if (toDate < fromDate) {
    throw new AemetError(`to (${to}) must be >= from (${from}).`);
  }
}
