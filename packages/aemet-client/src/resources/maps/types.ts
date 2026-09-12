export const SIGNIFICANT_MAP_AREAS = {
  spain: "esp",
  andalucia: "and",
  aragon: "arn",
  asturias: "ast",
  baleares: "bal",
  canarias: "coo",
  cantabria: "can",
  castillaLeon: "cle",
  castillaLaMancha: "clm",
  cataluna: "cat",
  valencia: "val",
  extremadura: "ext",
  galicia: "gal",
  madrid: "mad",
  murcia: "mur",
  navarra: "nav",
  paisVasco: "pva",
  laRioja: "rio",
} as const;

export type SignificantMapArea =
  (typeof SIGNIFICANT_MAP_AREAS)[keyof typeof SIGNIFICANT_MAP_AREAS] | (string & {});

export const SIGNIFICANT_MAP_PERIODS = {
  todayMorning: "a",
  todayAfternoon: "b",
  tomorrowMorning: "c",
  tomorrowAfternoon: "d",
  dayAfterMorning: "e",
  dayAfterAfternoon: "f",
} as const;

export type SignificantMapPeriod =
  (typeof SIGNIFICANT_MAP_PERIODS)[keyof typeof SIGNIFICANT_MAP_PERIODS] | (string & {});

export interface MapImage {
  url: string;
  metadataUrl?: string;
  contentType: string;
  bytes: Uint8Array;
}
