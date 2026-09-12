import { MOUNTAIN_AREAS, type MountainArea } from "aemet-client";
import { ResolutionError, normalize } from "../resolve.js";

export type MountainAreaKey = keyof typeof MOUNTAIN_AREAS;

export const MOUNTAIN_AREA_NAMES: Record<MountainAreaKey, string> = {
  picosDeEuropa: "Picos de Europa",
  pirineoNavarro: "Pirineo Navarro",
  pirineoAragones: "Pirineo Aragonés",
  pirineoCatalan: "Pirineo Catalán",
  ibericaRiojana: "Ibérica Riojana",
  ibericaAragonesa: "Ibérica Aragonesa",
  guadarramaSomosierra: "Sierras de Guadarrama y Somosierra",
  sierraGredos: "Sierra de Gredos",
  sierraNevada: "Sierra Nevada",
};

const MOUNTAIN_ALIASES: Record<string, MountainAreaKey> = {
  picosdeeuropa: "picosDeEuropa",
  picoseuropa: "picosDeEuropa",
  picos: "picosDeEuropa",
  cordilleracantabrica: "picosDeEuropa",
  cantabrica: "picosDeEuropa",
  naranjodebulnes: "picosDeEuropa",
  pirineonavarro: "pirineoNavarro",
  pirineosnavarros: "pirineoNavarro",
  pirineodenavarra: "pirineoNavarro",
  pirineosdenavarra: "pirineoNavarro",
  navarra: "pirineoNavarro",
  pirineoaragones: "pirineoAragones",
  pirineosaragoneses: "pirineoAragones",
  pirineodearagon: "pirineoAragones",
  pirineooscense: "pirineoAragones",
  huesca: "pirineoAragones",
  ordesa: "pirineoAragones",
  aneto: "pirineoAragones",
  pirineocatalan: "pirineoCatalan",
  pirineoscatalanes: "pirineoCatalan",
  pirineodecataluna: "pirineoCatalan",
  pirineucatala: "pirineoCatalan",
  pirineus: "pirineoCatalan",
  aran: "pirineoCatalan",
  valdaran: "pirineoCatalan",
  ibericariojana: "ibericaRiojana",
  sistemaibericoriojano: "ibericaRiojana",
  ibericalarioja: "ibericaRiojana",
  iberica: "ibericaRiojana",
  sistemaiberico: "ibericaRiojana",
  urbion: "ibericaRiojana",
  piecosierradeurbion: "ibericaRiojana",
  demanda: "ibericaRiojana",
  sierradelademanda: "ibericaRiojana",
  larioja: "ibericaRiojana",
  ibericaaragonesa: "ibericaAragonesa",
  sistemaibericoaragones: "ibericaAragonesa",
  ibericadearagon: "ibericaAragonesa",
  moncayo: "ibericaAragonesa",
  javalambre: "ibericaAragonesa",
  gudar: "ibericaAragonesa",
  sierrasdeguadarramaysomosierra: "guadarramaSomosierra",
  guadarramaysomosierra: "guadarramaSomosierra",
  guadarramasomosierra: "guadarramaSomosierra",
  sierradeguadarrama: "guadarramaSomosierra",
  guadarrama: "guadarramaSomosierra",
  somosierra: "guadarramaSomosierra",
  sierrademadrid: "guadarramaSomosierra",
  sierrasdemadrid: "guadarramaSomosierra",
  sierramadrid: "guadarramaSomosierra",
  madrid: "guadarramaSomosierra",
  penalara: "guadarramaSomosierra",
  navacerrada: "guadarramaSomosierra",
  sierradegredos: "sierraGredos",
  sierragredos: "sierraGredos",
  gredos: "sierraGredos",
  sierradebejarygredos: "sierraGredos",
  sierradebejar: "sierraGredos",
  bejar: "sierraGredos",
  almanzor: "sierraGredos",
  sierranevada: "sierraNevada",
  nevada: "sierraNevada",
  penibetica: "sierraNevada",
  cordillerapenibetica: "sierraNevada",
  sistemapenibetico: "sierraNevada",
  mulhacen: "sierraNevada",
  veleta: "sierraNevada",
  granada: "sierraNevada",
};

export interface ResolvedMountainArea {
  code: MountainArea;
  key: MountainAreaKey;
  name: string;
}

export function resolveMountainArea(input: string): ResolvedMountainArea {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ResolutionError("Empty mountain area", listHint());
  }

  const entries = Object.entries(MOUNTAIN_AREAS) as Array<[MountainAreaKey, MountainArea]>;
  const lower = trimmed.toLowerCase();
  const byCode = entries.find(([, code]) => code === lower);
  if (byCode) {
    return { code: byCode[1], key: byCode[0], name: MOUNTAIN_AREA_NAMES[byCode[0]] };
  }

  if (/^[a-z]{3}\d$/.test(lower)) {
    throw new ResolutionError(`No mountain area with code "${trimmed}"`, listHint());
  }

  const key = MOUNTAIN_ALIASES[normalize(trimmed)];
  if (!key) {
    throw new ResolutionError(`Unknown mountain area "${trimmed}"`, listHint());
  }
  return { code: MOUNTAIN_AREAS[key], key, name: MOUNTAIN_AREA_NAMES[key] };
}

function listHint(): string {
  const listed = (Object.entries(MOUNTAIN_AREAS) as Array<[MountainAreaKey, MountainArea]>)
    .map(([key, code]) => `${MOUNTAIN_AREA_NAMES[key]} (${code})`)
    .join(", ");
  return `AEMET publishes nine mountain areas: ${listed}.`;
}
