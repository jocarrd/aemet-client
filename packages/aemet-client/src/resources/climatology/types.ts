export interface ClimatologyDaily {
  fecha: string;
  indicativo: string;
  nombre: string;
  provincia: string;
  altitud: string;
  tmed?: string;
  prec?: string;
  tmin?: string;
  horatmin?: string;
  tmax?: string;
  horatmax?: string;
  dir?: string;
  velmedia?: string;
  racha?: string;
  horaracha?: string;
  presMax?: string;
  horaPresMax?: string;
  presMin?: string;
  horaPresMin?: string;
  hrMedia?: string;
  hrMax?: string;
  horaHrMax?: string;
  hrMin?: string;
  horaHrMin?: string;
  sol?: string;
}

export interface ClimatologyMonthly {
  fecha: string;
  indicativo: string;
  e?: string;
  n_cub?: string;
  hr?: string;
  n_gra?: string;
  n_fog?: string;
  inso?: string;
  q_max?: string;
  q_mar?: string;
  q_med?: string;
  q_min?: string;
  ta_max?: string;
  ta_min?: string;
  ts_min?: string;
  tm_max?: string;
  tm_mes?: string;
  tm_min?: string;
  np_300?: string;
  np_500?: string;
  np_700?: string;
  np_001?: string;
  p_max?: string;
  p_mes?: string;
  w_med?: string;
  w_racha?: string;
  w_rec?: string;
}

export type ClimatologyNormalVariable =
  | "e"
  | "evap"
  | "glo"
  | "hr"
  | "inso"
  | "n_cub"
  | "n_des"
  | "n_fog"
  | "n_gra"
  | "n_llu"
  | "n_nie"
  | "n_nub"
  | "n_tor"
  | "np_001"
  | "np_010"
  | "np_100"
  | "np_300"
  | "nt_00"
  | "nt_30"
  | "nv_0050"
  | "nv_0100"
  | "nv_1000"
  | "nw_55"
  | "nw_91"
  | "p_max"
  | "p_mes"
  | "p_sol"
  | "q_mar"
  | "q_max"
  | "q_med"
  | "q_min"
  | "ta_max"
  | "ta_min"
  | "ti_max"
  | "tm_max"
  | "tm_mes"
  | "tm_min"
  | "ts_10"
  | "ts_20"
  | "ts_50"
  | "ts_min"
  | "w_med"
  | "w_racha";

export type ClimatologyNormalStat =
  "md" | "mn" | "q1" | "q2" | "q3" | "q4" | "max" | "min" | "s" | "cv" | "n";

export type ClimatologyNormalField = `${ClimatologyNormalVariable}_${ClimatologyNormalStat}`;

export type ClimatologyNormal = {
  indicativo: string;
  mes: string;
} & Partial<Record<ClimatologyNormalField, string>>;

export interface StationInventoryEntry {
  latitud: string;
  provincia: string;
  altitud: string;
  indicativo: string;
  nombre: string;
  indsinop: string;
  longitud: string;
}
