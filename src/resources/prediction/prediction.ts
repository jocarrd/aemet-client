import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { Resource } from "../base.js";
import type {
  MunicipalDailyForecast,
  MunicipalHourlyForecast,
  MunicipioCode,
} from "./types.js";

const MUNICIPIO_RE = /^\d{5}$/;

export class PredictionResource extends Resource {
  async municipalDaily(
    municipio: MunicipioCode,
    options: RequestOptions = {},
  ): Promise<MunicipalDailyForecast[]> {
    assertMunicipio(municipio);
    const { data } = await this.transport.request<MunicipalDailyForecast[]>(
      `/prediccion/especifica/municipio/diaria/${municipio}`,
      options,
    );
    return data;
  }

  async municipalHourly(
    municipio: MunicipioCode,
    options: RequestOptions = {},
  ): Promise<MunicipalHourlyForecast[]> {
    assertMunicipio(municipio);
    const { data } = await this.transport.request<MunicipalHourlyForecast[]>(
      `/prediccion/especifica/municipio/horaria/${municipio}`,
      options,
    );
    return data;
  }
}

function assertMunicipio(municipio: string): void {
  if (!MUNICIPIO_RE.test(municipio)) {
    throw new AemetError(
      `Invalid municipio code: ${JSON.stringify(municipio)}. Expected 5 digits (INE format), e.g. "28079".`,
    );
  }
}
