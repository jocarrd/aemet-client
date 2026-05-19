import { AemetError } from "../errors.js";

export type AemetDateInput = Date | string;

export function toAemetDate(input: AemetDateInput): string {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new AemetError("Invalid Date passed to toAemetDate.");
    }
    return formatDate(input);
  }
  if (typeof input !== "string") {
    throw new AemetError(`Expected Date or string, received ${typeof input}.`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}UTC$/.test(input)) return input;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return `${input}T00:00:00UTC`;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new AemetError(`Could not parse date: ${JSON.stringify(input)}.`);
  }
  return formatDate(parsed);
}

function formatDate(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}UTC`;
}

export function parseSpanishNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}
