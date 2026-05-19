export type IdemaCode = string;

export interface StationObservation {
  idema: string;
  lon: number;
  lat: number;
  alt: number;
  ubi: string;
  fint: string;
  ta?: number;
  tamin?: number;
  tamax?: number;
  ts?: number;
  tss5cm?: number;
  tss20cm?: number;
  tpr?: number;
  hr?: number;
  pres?: number;
  pres_nmar?: number;
  prec?: number;
  vv?: number;
  vmax?: number;
  dv?: number;
  dmax?: number;
  stdvv?: number;
  stddv?: number;
  rviento?: number;
  inso?: number;
  vis?: number;
  nieve?: number;
}
