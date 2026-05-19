import { CAP_AREAS, type CapAreaCode } from "aemet-client";
import {
  findMunicipalitiesByName,
  findMunicipalityByCode,
  findNearestMunicipality,
  type Municipality,
} from "aemet-client/data";

export class ResolutionError extends Error {
  override readonly name = "ResolutionError";
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export interface ResolvedMunicipality {
  ineCode: string;
  name: string;
  lat: number;
  lon: number;
  matchedBy: "ine" | "name" | "coordinates";
  alternatives?: Municipality[];
}

export function resolveMunicipality(input: string): ResolvedMunicipality {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ResolutionError("Empty location", "Pass a municipality name or 5-digit INE code.");
  }

  if (/^\d{5}$/.test(trimmed)) {
    const found = findMunicipalityByCode(trimmed);
    if (!found) {
      throw new ResolutionError(
        `No municipality with INE code "${trimmed}"`,
        "Valid INE codes are 5 digits (e.g. 28079 for Madrid).",
      );
    }
    return { ...found, matchedBy: "ine" };
  }

  const matches = findMunicipalitiesByName(trimmed, 5);
  if (matches.length === 0) {
    throw new ResolutionError(
      `No municipality matches "${trimmed}"`,
      "Try the official Spanish name (e.g. 'Logroño', 'A Coruña') or the 5-digit INE code.",
    );
  }
  const [best, ...rest] = matches;
  return {
    ...best!,
    matchedBy: "name",
    ...(rest.length > 0 ? { alternatives: rest } : {}),
  };
}

export function resolveMunicipalityByCoords(lat: number, lon: number): ResolvedMunicipality {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new ResolutionError("Coordinates must be finite numbers");
  }
  const nearest = findNearestMunicipality({ lat, lon });
  if (!nearest) {
    throw new ResolutionError("No municipality found near coordinates");
  }
  return { ...nearest.item, matchedBy: "coordinates" };
}

const CAP_ALIASES: Record<string, keyof typeof CAP_AREAS> = {
  esp: "esp",
  espana: "esp",
  spain: "esp",
  es: "esp",
  andalucia: "andalucia",
  aragon: "aragon",
  asturias: "asturias",
  principadodeasturias: "asturias",
  baleares: "baleares",
  islasbaleares: "baleares",
  illesbalears: "baleares",
  canarias: "canarias",
  islascanarias: "canarias",
  cantabria: "cantabria",
  castillalamancha: "castillaLaMancha",
  clm: "castillaLaMancha",
  castillayleon: "castillaYLeon",
  castillaleon: "castillaYLeon",
  cyl: "castillaYLeon",
  cataluna: "cataluna",
  catalunya: "cataluna",
  catalonia: "cataluna",
  ceutaymelilla: "ceutaMelilla",
  ceuta: "ceutaMelilla",
  melilla: "ceutaMelilla",
  extremadura: "extremadura",
  galicia: "galicia",
  larioja: "laRioja",
  rioja: "laRioja",
  madrid: "madrid",
  comunidaddemadrid: "madrid",
  murcia: "murcia",
  regiondemurcia: "murcia",
  navarra: "navarra",
  comunidadforaldenavarra: "navarra",
  nafarroa: "navarra",
  paisvasco: "paisVasco",
  euskadi: "paisVasco",
  euskalherria: "paisVasco",
  valencia: "valencia",
  comunidadvalenciana: "valencia",
  comunitatvalenciana: "valencia",
  cv: "valencia",
};

export interface ResolvedCapArea {
  code: CapAreaCode;
  key: keyof typeof CAP_AREAS;
}

export function resolveCapArea(input: string): ResolvedCapArea {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ResolutionError("Empty area");
  }

  if (trimmed === "esp" || trimmed.toLowerCase() === "esp") {
    return { code: CAP_AREAS.esp, key: "esp" };
  }

  if (/^\d{2}$/.test(trimmed)) {
    const entry = (Object.entries(CAP_AREAS) as Array<[keyof typeof CAP_AREAS, CapAreaCode]>).find(
      ([, code]) => code === trimmed,
    );
    if (!entry) {
      throw new ResolutionError(
        `No CAP area with code "${trimmed}"`,
        "Valid codes are 2-digit (e.g. 73 for La Rioja) or 'esp' for national.",
      );
    }
    return { code: entry[1], key: entry[0] };
  }

  const key = CAP_ALIASES[normalize(trimmed)];
  if (!key) {
    throw new ResolutionError(
      `Unknown autonomous community "${trimmed}"`,
      "Use the name of a Spanish autonomous community (e.g. 'Cataluña', 'Madrid', 'La Rioja') or 'esp' for national.",
    );
  }
  return { code: CAP_AREAS[key], key };
}
