import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import type { CoastalArea, HighSeasArea, MaritimeForecast } from "./types.js";

const AREA_RE = /^\d{1,2}$/;

export class MaritimeResource extends Resource {
  async highSeas(area: HighSeasArea, options: RequestOptions = {}): Promise<MaritimeForecast> {
    assertArea(area, "highSeas");
    const { data } = await this.transport.request<MaritimeForecast>(
      `/prediccion/maritima/altamar/area/${area}`,
      options,
    );
    return data;
  }

  async coastal(coast: CoastalArea, options: RequestOptions = {}): Promise<MaritimeForecast> {
    assertArea(coast, "coastal");
    const { data } = await this.transport.request<MaritimeForecast>(
      `/prediccion/maritima/costera/costa/${coast}`,
      options,
    );
    return data;
  }
}

function assertArea(area: string, label: string): void {
  if (!AREA_RE.test(area)) {
    throw new AemetError(
      `Invalid ${label} area: ${JSON.stringify(area)}. Expected a 1-2 digit code.`,
    );
  }
}
