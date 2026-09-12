import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import {
  MOUNTAIN_AREAS,
  type MountainArea,
  type MountainBulletin,
  type MountainDay,
} from "./types.js";

const AREAS = new Set<string>(Object.values(MOUNTAIN_AREAS));
const DAY_RE = /^[0-3]$/;

export class MountainResource extends Resource {
  async forecast(
    area: MountainArea,
    day: MountainDay,
    options: RequestOptions = {},
  ): Promise<MountainBulletin[]> {
    assertArea(area);
    const dayStr = assertDay(day);
    const { data } = await this.transport.request<MountainBulletin[]>(
      `/prediccion/especifica/montaña/pasada/area/${area}/dia/${dayStr}`,
      options,
    );
    return data;
  }

  async past(area: MountainArea, options: RequestOptions = {}): Promise<MountainBulletin[]> {
    assertArea(area);
    const { data } = await this.transport.request<MountainBulletin[]>(
      `/prediccion/especifica/montaña/pasada/area/${area}`,
      options,
    );
    return data;
  }
}

function assertArea(area: string): void {
  if (!AREAS.has(area)) {
    throw new AemetError(
      `Invalid mountain area: ${JSON.stringify(area)}. Expected one of ${[...AREAS].join(", ")}.`,
    );
  }
}

function assertDay(day: MountainDay): string {
  const str = String(day);
  if (!DAY_RE.test(str)) {
    throw new AemetError(`Invalid day: ${JSON.stringify(day)}. Expected 0 (today) to 3.`);
  }
  return str;
}
