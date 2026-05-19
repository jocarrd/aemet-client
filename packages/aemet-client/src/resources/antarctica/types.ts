export const ANTARCTICA_STATIONS = {
  juanCarlosI: "89064",
  gabrielDeCastilla: "89070",
} as const;

export type AntarcticaStation =
  | (typeof ANTARCTICA_STATIONS)[keyof typeof ANTARCTICA_STATIONS]
  | (string & {});

export interface AntarcticaObservation {
  identificacion: string;
  nombre?: string;
  fhora: string;
  temp?: number;
  pres?: number;
  vel_viento?: number;
  dir_viento?: number;
  rad_solar?: number;
  hum_rel?: number;
  alb?: number;
  ttierra?: number;
  prec?: number;
}
