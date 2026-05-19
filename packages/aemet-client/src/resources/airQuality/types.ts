export const POLLUTION_NETWORKS = {
  cyl: "cyl",
  gal: "gal",
  esp: "esp",
} as const;

export type PollutionNetwork =
  | (typeof POLLUTION_NETWORKS)[keyof typeof POLLUTION_NETWORKS]
  | (string & {});

export interface PollutionMeasurement {
  estacion: string;
  red: string;
  fecha: string;
  contaminante: string;
  concentracion?: number;
  unidad?: string;
  validez?: string;
}
