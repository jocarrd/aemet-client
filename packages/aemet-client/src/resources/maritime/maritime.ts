import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import {
  COASTAL_AREAS,
  HIGH_SEAS_AREAS,
  type CoastalArea,
  type HighSeasArea,
  type MaritimeForecast,
} from "./types.js";

const HIGH_SEAS = new Set<string>(Object.values(HIGH_SEAS_AREAS));
const COASTAL = new Set<string>(Object.values(COASTAL_AREAS));

export class MaritimeResource extends Resource {
  async highSeas(area: HighSeasArea, options: RequestOptions = {}): Promise<MaritimeForecast> {
    assertArea(area, HIGH_SEAS, "high seas area");
    const { data } = await this.transport.request<MaritimeForecast>(
      `/prediccion/maritima/altamar/area/${area}`,
      options,
    );
    return data;
  }

  async coastal(coast: CoastalArea, options: RequestOptions = {}): Promise<MaritimeForecast> {
    assertArea(coast, COASTAL, "coastal area");
    const { data } = await this.transport.request<MaritimeForecast>(
      `/prediccion/maritima/costera/costa/${coast}`,
      options,
    );
    return data;
  }
}

function assertArea(area: string, allowed: Set<string>, label: string): void {
  if (!allowed.has(area)) {
    throw new AemetError(
      `Invalid ${label}: ${JSON.stringify(area)}. Expected one of ${[...allowed].join(", ")}.`,
    );
  }
}
