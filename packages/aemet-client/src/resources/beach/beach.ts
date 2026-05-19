import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import type { BeachForecast, PlayaCode } from "./types.js";

const PLAYA_RE = /^\d{5,11}$/;

export class BeachResource extends Resource {
  async forecast(playa: PlayaCode, options: RequestOptions = {}): Promise<BeachForecast[]> {
    assertPlaya(playa);
    const { data } = await this.transport.request<BeachForecast[]>(
      `/prediccion/especifica/playa/${playa}`,
      options,
    );
    return data;
  }
}

function assertPlaya(playa: string): void {
  if (!PLAYA_RE.test(playa)) {
    throw new AemetError(
      `Invalid beach code: ${JSON.stringify(playa)}. Expected 5-11 digits.`,
    );
  }
}
