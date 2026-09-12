export const MOUNTAIN_AREAS = {
  picosDeEuropa: "peu1",
  pirineoNavarro: "nav1",
  pirineoAragones: "arn1",
  pirineoCatalan: "cat1",
  ibericaRiojana: "rio1",
  ibericaAragonesa: "arn2",
  guadarramaSomosierra: "mad2",
  sierraGredos: "gre1",
  sierraNevada: "nev1",
} as const;

export type MountainArea = (typeof MOUNTAIN_AREAS)[keyof typeof MOUNTAIN_AREAS] | (string & {});
export type MountainDay = 0 | 1 | 2 | 3 | "0" | "1" | "2" | "3";

export interface MountainOrigin {
  productor: string;
  web: string;
  tipo: string;
  language: string;
  copyright: string;
  notaLegal: string;
}

export interface MountainBulletinItem {
  cabecera?: string;
  texto: string;
  nombre?: string;
}

export interface MountainBulletinParagraph {
  texto: string;
  numero: string;
}

export interface MountainBulletinSection {
  nombre: string;
  apartado: MountainBulletinItem[];
  parrafo: MountainBulletinParagraph[];
  lugar: Array<Record<string, unknown>>;
}

export interface MountainBulletin {
  id: string;
  nombre: string;
  origen: MountainOrigin;
  seccion: MountainBulletinSection[];
}
