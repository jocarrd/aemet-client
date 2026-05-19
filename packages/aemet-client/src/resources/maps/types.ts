export const SIGNIFICANT_MAP_AREAS = {
  spain: "esp",
  peninsulaBaleares: "a",
  canarias: "b",
} as const;

export type SignificantMapArea =
  | (typeof SIGNIFICANT_MAP_AREAS)[keyof typeof SIGNIFICANT_MAP_AREAS]
  | (string & {});

export interface MapImage {
  url: string;
  metadataUrl?: string;
  contentType: string;
  bytes: Uint8Array;
}
