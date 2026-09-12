export const HIGH_SEAS_AREAS = {
  atlanticoSur: "0",
  atlanticoNorte: "1",
  mediterraneo: "2",
} as const;

export type HighSeasArea = (typeof HIGH_SEAS_AREAS)[keyof typeof HIGH_SEAS_AREAS] | (string & {});

export const COASTAL_AREAS = {
  galicia: "40",
  cantabrico: "41",
  andaluciaOccidentalCeuta: "42",
  canarias: "43",
  baleares: "44",
  cataluna: "45",
  valenciaMurcia: "46",
  andaluciaOrientalMelilla: "47",
} as const;

export type CoastalArea = (typeof COASTAL_AREAS)[keyof typeof COASTAL_AREAS] | (string & {});

export interface MaritimeForecastSubzone {
  origen: {
    productor: string;
    web: string;
    enlace: string;
    language: string;
    copyright: string;
    notaLegal: string;
  };
  nombre: string;
  id: string;
  tipo: "altamar" | "costera";
  iniciovalidez?: string;
  finvalidez?: string;
  aviso?: string;
  situacion?: string;
  subzona?: Array<Record<string, unknown>>;
  prediccion?: Record<string, unknown>;
}

export type MaritimeForecast = MaritimeForecastSubzone[];
