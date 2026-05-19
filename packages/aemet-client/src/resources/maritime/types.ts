export type HighSeasArea = string;
export type CoastalArea = string;

export interface MaritimeForecastSubzone {
  origen: { productor: string; web: string; enlace: string; language: string; copyright: string; notaLegal: string };
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
