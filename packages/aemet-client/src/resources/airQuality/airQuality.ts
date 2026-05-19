import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import type { PollutionMeasurement, PollutionNetwork } from "./types.js";

const STATION_RE = /^[A-Z0-9]{3,8}$/i;
const NETWORK_RE = /^[a-z0-9]{2,6}$/i;

export class AirQualityResource extends Resource {
  async backgroundPollution(
    station: string,
    network: PollutionNetwork,
    options: RequestOptions = {},
  ): Promise<PollutionMeasurement[]> {
    assertStation(station);
    assertNetwork(network);
    const { data } = await this.transport.request<PollutionMeasurement[]>(
      `/red/especial/contaminacionfondo/estacion/${station}/red/${network}`,
      options,
    );
    return data;
  }
}

function assertStation(station: string): void {
  if (!STATION_RE.test(station)) {
    throw new AemetError(
      `Invalid pollution station: ${JSON.stringify(station)}. Expected 3-8 alphanumeric.`,
    );
  }
}

function assertNetwork(network: string): void {
  if (!NETWORK_RE.test(network)) {
    throw new AemetError(
      `Invalid pollution network: ${JSON.stringify(network)}. Expected a short alphanumeric code (e.g. "esp", "cyl").`,
    );
  }
}
