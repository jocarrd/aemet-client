import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import type { MountainArea, MountainForecast, MountainPeriod } from "./types.js";

const AREA_RE = /^[1-8]$/;
const PERIOD_RE = /^[01]$/;

export class MountainResource extends Resource {
  async forecast(
    area: MountainArea,
    period: MountainPeriod,
    options: RequestOptions = {},
  ): Promise<MountainForecast[]> {
    assertArea(area);
    const periodStr = assertPeriod(period);
    const { data } = await this.transport.request<MountainForecast[]>(
      `/prediccion/especifica/montaña/${area}/periodo/${periodStr}`,
      options,
    );
    return data;
  }

  async past(
    area: MountainArea,
    day: MountainPeriod,
    options: RequestOptions = {},
  ): Promise<MountainForecast[]> {
    assertArea(area);
    const dayStr = assertPeriod(day);
    const { data } = await this.transport.request<MountainForecast[]>(
      `/prediccion/especifica/montaña/pasada/area/${area}/dia/${dayStr}`,
      options,
    );
    return data;
  }
}

function assertArea(area: string): void {
  if (!AREA_RE.test(area)) {
    throw new AemetError(
      `Invalid mountain area: ${JSON.stringify(area)}. Expected "1"-"8".`,
    );
  }
}

function assertPeriod(period: MountainPeriod): string {
  const str = String(period);
  if (!PERIOD_RE.test(str)) {
    throw new AemetError(`Invalid period: ${JSON.stringify(period)}. Expected 0 or 1.`);
  }
  return str;
}
