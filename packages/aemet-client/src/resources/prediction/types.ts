export type MunicipioCode = string;

export interface ForecastOrigin {
  productor: string;
  web: string;
  enlace: string;
  language: string;
  copyright: string;
  notaLegal: string;
}

export interface PeriodValue {
  value: string;
  periodo?: string;
}

export interface PeriodDescribedValue extends PeriodValue {
  descripcion?: string;
}

export interface WindEntry {
  periodo?: string;
  direccion: string;
  velocidad: string;
}

export interface TemperatureEntry {
  maxima: number;
  minima: number;
  dato: Array<{ hora: number; value: number }>;
}

export interface MunicipalDailyForecastDay {
  fecha: string;
  probPrecipitacion: PeriodValue[];
  cotaNieveProv: PeriodValue[];
  estadoCielo: PeriodDescribedValue[];
  viento: WindEntry[];
  rachaMax: PeriodValue[];
  temperatura: TemperatureEntry;
  sensTermica: TemperatureEntry;
  humedadRelativa: { maxima: number; minima: number; dato: Array<{ hora: number; value: number }> };
  uvMax?: number;
}

export interface MunicipalDailyForecast {
  origen: ForecastOrigin;
  elaborado: string;
  nombre: string;
  provincia: string;
  prediccion: { dia: MunicipalDailyForecastDay[] };
  id: string;
  version: string;
}

export interface HourlyHumidityEntry {
  value: string;
  periodo: string;
}

export interface HourlyForecastDay {
  fecha: string;
  estadoCielo: PeriodDescribedValue[];
  precipitacion: PeriodValue[];
  probPrecipitacion: Array<{ value: string; periodo: string }>;
  probTormenta: Array<{ value: string; periodo: string }>;
  nieve: PeriodValue[];
  probNieve: Array<{ value: string; periodo: string }>;
  temperatura: PeriodValue[];
  sensTermica: PeriodValue[];
  humedadRelativa: HourlyHumidityEntry[];
  vientoAndRachaMax: Array<{
    periodo: string;
    direccion?: string[];
    velocidad?: string[];
    value?: string;
  }>;
  orto?: string;
  ocaso?: string;
}

export interface MunicipalHourlyForecast {
  origen: ForecastOrigin;
  elaborado: string;
  nombre: string;
  provincia: string;
  prediccion: { dia: HourlyForecastDay[] };
  id: string;
  version: string;
}
