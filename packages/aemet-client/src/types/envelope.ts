export interface AemetEnvelope {
  descripcion: string;
  estado: number;
  datos?: string;
  metadatos?: string;
}

export function isAemetEnvelope(value: unknown): value is AemetEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.descripcion === "string" && typeof v.estado === "number";
}
