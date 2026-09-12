export const POLLUTION_STATIONS = {
  sanPabloDeLosMontes: "01",
  noia: "05",
  mahon: "06",
  viznar: "07",
  niembroLlanes: "08",
  campisabalos: "09",
  caboDeCreus: "10",
  barcarrota: "11",
  zarra: "12",
  penausende: "13",
  elsTorms: "14",
  oSavinao: "16",
  donana: "17",
} as const;

export type PollutionStation =
  (typeof POLLUTION_STATIONS)[keyof typeof POLLUTION_STATIONS] | (string & {});

export interface PollutionReading {
  parameter: string;
  code: string;
  value: number;
  unit: string;
  validity: string;
  factor?: number;
}

export interface PollutionMeasurement {
  station: string;
  timestamp: string;
  readings: PollutionReading[];
}
