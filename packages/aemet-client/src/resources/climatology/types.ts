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

export interface ClimatologyNormal {
  indicativo: string;
  mes: string;
  p_med?: string;
  p_max?: string;
  p_min?: string;
  t_med?: string;
  ta_max?: string;
  ta_min?: string;
  d_nie?: string;
  d_llu?: string;
  d_gra?: string;
  d_tor?: string;
  d_fog?: string;
  d_des?: string;
  d_cub?: string;
  h_med?: string;
  i_med?: string;
}

export interface StationInventoryEntry {
  latitud: string;
  provincia: string;
  altitud: string;
  indicativo: string;
  nombre: string;
  indsinop: string;
  longitud: string;
}
