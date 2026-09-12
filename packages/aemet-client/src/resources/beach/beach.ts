import { AemetError, AemetNotFoundError, type AemetErrorContext } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import type { BeachForecast, PlayaCode } from "./types.js";

const PLAYA_RE = /^\d{7}$/;

export class BeachForecastUnavailableError extends AemetNotFoundError {
  readonly playa: PlayaCode;

  constructor(playa: PlayaCode, context: AemetErrorContext = {}) {
    super(context);
    this.name = "BeachForecastUnavailableError";
    this.message =
      `AEMET publishes no forecast for beach ${playa}. ` +
      "Beach forecasts are seasonal and only cover the 591 beaches AEMET forecasts: " +
      "outside the mid-May to mid-September bathing season the endpoint answers 404.";
    this.playa = playa;
  }
}

export class BeachResource extends Resource {
  async forecast(playa: PlayaCode, options: RequestOptions = {}): Promise<BeachForecast[]> {
    assertPlaya(playa);
    const endpoint = `/prediccion/especifica/playa/${playa}`;
    try {
      const { data } = await this.transport.request<BeachForecast[]>(endpoint, options);
      return data;
    } catch (error) {
      if (error instanceof AemetNotFoundError) {
        throw new BeachForecastUnavailableError(playa, {
          endpoint,
          status: error.status ?? 404,
          ...(error.description !== undefined ? { description: error.description } : {}),
        });
      }
      throw error;
    }
  }
}

function assertPlaya(playa: string): void {
  if (!PLAYA_RE.test(playa)) {
    throw new AemetError(
      `Invalid beach code: ${JSON.stringify(playa)}. Expected 7 digits: the 5-digit INE municipality code plus a 2-digit beach number (e.g. "3908503" La Concha, Suances).`,
    );
  }
}
