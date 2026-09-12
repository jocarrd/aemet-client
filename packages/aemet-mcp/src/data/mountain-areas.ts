import { MOUNTAIN_AREAS, type MountainArea } from "aemet-client";
import { ResolutionError, normalize } from "../resolve.js";

export type MountainAreaKey = keyof typeof MOUNTAIN_AREAS;

export const MOUNTAIN_AREA_NAMES: Record<MountainAreaKey, string> = {
  picosDeEuropa: "Picos de Europa",
  pirineoNavarro: "Pirineo Navarro",
  pirineoAragones: "Pirineo Aragonés",
  pirineoCatalan: "Pirineo Catalán",
  sierraMadrid: "Sierra de Madrid",
  iberica: "Ibérica",
  sierraNevada: "Sierra Nevada",
  bejarGredos: "Sierra de Béjar y Gredos",
};

const MOUNTAIN_ALIASES: Record<string, MountainAreaKey> = {
  picosdeeuropa: "picosDeEuropa",
  picoseuropa: "picosDeEuropa",
  picos: "picosDeEuropa",
  cordilleracantabrica: "picosDeEuropa",
  cantabrica: "picosDeEuropa",
  pirineonavarro: "pirineoNavarro",
  pirineosnavarros: "pirineoNavarro",
  pirineodenavarra: "pirineoNavarro",
  pirineoaragones: "pirineoAragones",
  pirineosaragoneses: "pirineoAragones",
  pirineodearagon: "pirineoAragones",
  pirineocatalan: "pirineoCatalan",
  pirineoscatalanes: "pirineoCatalan",
  pirineodecataluna: "pirineoCatalan",
  pirineucatala: "pirineoCatalan",
  sierrademadrid: "sierraMadrid",
  sierramadrid: "sierraMadrid",
  guadarrama: "sierraMadrid",
  sierradeguadarrama: "sierraMadrid",
  penalara: "sierraMadrid",
  iberica: "iberica",
  sistemaiberico: "iberica",
  ibericariojana: "iberica",
  ibericaaragonesa: "iberica",
  moncayo: "iberica",
  urbion: "iberica",
  sierranevada: "sierraNevada",
  nevada: "sierraNevada",
  penibetica: "sierraNevada",
  bejargredos: "bejarGredos",
  sierradebejarygredos: "bejarGredos",
  sierradebejar: "bejarGredos",
  sierradegredos: "bejarGredos",
  bejar: "bejarGredos",
  gredos: "bejarGredos",
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

  if (/^[1-8]$/.test(trimmed)) {
    const entry = (Object.entries(MOUNTAIN_AREAS) as Array<[MountainAreaKey, MountainArea]>).find(
      ([, code]) => code === trimmed,
    );
    if (!entry) {
      throw new ResolutionError(`No mountain area with code "${trimmed}"`, listHint());
    }
    return { code: entry[1], key: entry[0], name: MOUNTAIN_AREA_NAMES[entry[0]] };
  }

  if (/^\d+$/.test(trimmed)) {
    throw new ResolutionError(`No mountain area with code "${trimmed}"`, "Valid codes are 1-8.");
  }

  const key = MOUNTAIN_ALIASES[normalize(trimmed)];
  if (!key) {
    throw new ResolutionError(`Unknown mountain area "${trimmed}"`, listHint());
  }
  return { code: MOUNTAIN_AREAS[key], key, name: MOUNTAIN_AREA_NAMES[key] };
}

function listHint(): string {
  const names = Object.values(MOUNTAIN_AREA_NAMES).join(", ");
  return `AEMET publishes 8 mountain areas: ${names}. You can also pass the code 1-8.`;
}
