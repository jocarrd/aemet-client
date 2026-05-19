export const MOUNTAIN_AREAS = {
  picosDeEuropa: "1",
  pirineoNavarro: "2",
  pirineoAragones: "3",
  pirineoCatalan: "4",
  sierraMadrid: "5",
  iberica: "6",
  sierraNevada: "7",
  bejarGredos: "8",
} as const;

export type MountainArea = (typeof MOUNTAIN_AREAS)[keyof typeof MOUNTAIN_AREAS] | (string & {});
export type MountainPeriod = 0 | 1 | "0" | "1";

export interface MountainForecastEntry {
  periodo?: string;
  value?: string;
  descripcion?: string;
  altitud?: string;
  direccion?: string;
  velocidad?: string;
}

export interface MountainForecastDay {
  fecha: string;
  estadoCielo: MountainForecastEntry[];
  precipitacion: MountainForecastEntry[];
  cotaNieveProv?: MountainForecastEntry[];
  cotaNieve?: MountainForecastEntry[];
  isoCero?: MountainForecastEntry[];
  isoMenosUno?: MountainForecastEntry[];
  isoMenosDiez?: MountainForecastEntry[];
  vientoSuperficie?: MountainForecastEntry[];
  viento3000m?: MountainForecastEntry[];
  viento2500m?: MountainForecastEntry[];
  viento1500m?: MountainForecastEntry[];
  viento1000m?: MountainForecastEntry[];
  viento500m?: MountainForecastEntry[];
  temperatura?: MountainForecastEntry[];
}

export interface MountainForecast {
  nombre: string;
  id: string;
  elaborado: string;
  origen: {
    productor: string;
    web: string;
    enlace: string;
    language: string;
    copyright: string;
    notaLegal: string;
  };
  prediccion: { dia: MountainForecastDay[] };
}
