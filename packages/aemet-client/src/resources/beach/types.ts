export type PlayaCode = string;

export interface BeachForecastDay {
  fecha: string;
  estadoCielo: { value: string; descripcion?: string };
  viento: { value: string };
  oleaje: { value: string };
  tMaxima?: { valor1?: number; valor2?: number };
  sTermica?: { valor1?: string; valor2?: string };
  tAgua?: { valor1?: number; valor2?: number };
  uvMax?: number;
}

export interface BeachForecast {
  elaborado: string;
  nombre: string;
  localidad?: string;
  municipio: { id: string; nombre: string };
  subZona?: { id: string; nombre: string };
  id: string;
  origen: {
    productor: string;
    web: string;
    enlace: string;
    language: string;
    copyright: string;
    notaLegal: string;
  };
  prediccion: { dia: BeachForecastDay[] };
}
