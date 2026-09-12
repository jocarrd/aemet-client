export const REGIONAL_RADARS = {
  almeria: "am",
  asturias: "sa",
  baleares: "pm",
  barcelona: "ba",
  caceres: "cc",
  coruna: "co",
  madrid: "ma",
  malaga: "ml",
  murcia: "mu",
  palencia: "vd",
  lasPalmas: "ca",
  sevilla: "se",
  valencia: "va",
  vizcaya: "ss",
  zaragoza: "za",
} as const;

export type RegionalRadarCode =
  (typeof REGIONAL_RADARS)[keyof typeof REGIONAL_RADARS] | (string & {});

export interface RadarImage {
  url: string;
  metadataUrl?: string;
  contentType: string;
  bytes: Uint8Array;
}
