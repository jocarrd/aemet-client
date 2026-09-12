export type PlayaCode = string;

export interface BeachForecastOrigin {
  productor: string;
  web: string;
  language: string;
  copyright: string;
  notaLegal: string;
}

export interface BeachMorningAfternoon {
  value: string;
  f1: number;
  descripcion1: string;
  f2: number;
  descripcion2: string;
}

export interface BeachDailyValue {
  value: string;
  valor1: number;
}

export interface BeachThermalSensation extends BeachDailyValue {
  descripcion1: string;
}

export interface BeachForecastDay {
  fecha: number;
  estadoCielo: BeachMorningAfternoon;
  viento: BeachMorningAfternoon;
  oleaje: BeachMorningAfternoon;
  tMaxima: BeachDailyValue;
  sTermica: BeachThermalSensation;
  tAgua: BeachDailyValue;
  uvMax: BeachDailyValue;
  tmaxima?: BeachDailyValue;
  stermica?: BeachThermalSensation;
  tagua?: BeachDailyValue;
}

export interface BeachForecast {
  origen: BeachForecastOrigin;
  elaborado: string;
  nombre: string;
  localidad: number;
  id: number;
  prediccion: { dia: BeachForecastDay[] };
}
