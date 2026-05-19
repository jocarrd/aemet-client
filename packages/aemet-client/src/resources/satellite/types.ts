export const SATELLITE_PRODUCTS = {
  ircos: "ircos",
  irco: "irco",
  irir: "irir",
  irir1: "irir1",
  irmi: "irmi",
  iruv: "iruv",
  iruv1: "iruv1",
  nubes: "nubes",
  sat: "sat",
} as const;

export type SatelliteProduct =
  | (typeof SATELLITE_PRODUCTS)[keyof typeof SATELLITE_PRODUCTS]
  | (string & {});

export interface SatelliteImage {
  url: string;
  metadataUrl?: string;
  contentType: string;
  bytes: Uint8Array;
}
