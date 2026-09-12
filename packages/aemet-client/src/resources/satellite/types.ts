export const SATELLITE_PRODUCTS = {
  nvdi: "nvdi",
  sst: "sst",
} as const;

export type SatelliteProduct =
  (typeof SATELLITE_PRODUCTS)[keyof typeof SATELLITE_PRODUCTS] | (string & {});

export interface SatelliteImage {
  url: string;
  metadataUrl?: string;
  contentType: string;
  bytes: Uint8Array;
}
