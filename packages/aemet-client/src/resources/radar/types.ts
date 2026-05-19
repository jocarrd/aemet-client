export const REGIONAL_RADARS = {
  almeria: "am",
  barcelona: "ba",
  caceres: "ca",
  coruna: "lc",
  laPalma: "lp",
  madrid: "mh",
  malaga: "ml",
  murcia: "mu",
  palma: "pm",
  santander: "ss",
  sevilla: "se",
  valencia: "vc",
  valladolid: "vd",
  zaragoza: "za",
} as const;

export type RegionalRadarCode = (typeof REGIONAL_RADARS)[keyof typeof REGIONAL_RADARS] | (string & {});

export interface RadarImage {
  url: string;
  metadataUrl?: string;
  contentType: string;
  bytes: Uint8Array;
}
