import { AemetError } from "../../errors.js";
import type { RequestOptions } from "../../transport.js";
import { toAemetDate, type AemetDateInput } from "../../utils/date.js";
import { Resource } from "../base.js";
import type {
  ClimatologyDaily,
  ClimatologyMonthly,
  ClimatologyNormal,
  StationInventoryEntry,
} from "./types.js";

const IDEMA_RE = /^[A-Z0-9]{3,6}$/i;
const YEAR_RE = /^\d{4}$/;
const MAX_DAILY_RANGE_DAYS = 186;
const MAX_MONTHLY_RANGE_YEARS = 3;

export class ClimatologyResource extends Resource {
  async daily(
    idema: string,
    from: AemetDateInput,
    to: AemetDateInput,
    options: RequestOptions = {},
  ): Promise<ClimatologyDaily[]> {
    assertIdema(idema);
    const fromStr = toAemetDate(from);
    const toStr = toAemetDate(to);
    assertRange(fromStr, toStr);
    const { data } = await this.transport.request<ClimatologyDaily[]>(
      `/valores/climatologicos/diarios/datos/fechaini/${fromStr}/fechafin/${toStr}/estacion/${idema}`,
      options,
    );
    return data;
  }

  async monthly(
    idema: string,
    fromYear: number | string,
    toYear: number | string,
    options: RequestOptions = {},
  ): Promise<ClimatologyMonthly[]> {
    assertIdema(idema);
    const fromY = assertYear(fromYear, "fromYear");
    const toY = assertYear(toYear, "toYear");
    if (toY < fromY) {
      throw new AemetError(`toYear (${toY}) must be >= fromYear (${fromY}).`);
    }
    if (toY - fromY > MAX_MONTHLY_RANGE_YEARS) {
      throw new AemetError(
        `Year range ${fromY}-${toY} exceeds AEMET's limit of 36 months for monthly/annual values. ` +
          `Request it in chunks of at most ${MAX_MONTHLY_RANGE_YEARS + 1} calendar years (toYear - fromYear <= ${MAX_MONTHLY_RANGE_YEARS}).`,
      );
    }
    const { data } = await this.transport.request<ClimatologyMonthly[]>(
      `/valores/climatologicos/mensualesanuales/datos/anioini/${fromY}/aniofin/${toY}/estacion/${idema}`,
      options,
    );
    return data;
  }

  async normals(idema: string, options: RequestOptions = {}): Promise<ClimatologyNormal[]> {
    assertIdema(idema);
    const { data } = await this.transport.request<ClimatologyNormal[]>(
      `/valores/climatologicos/normales/estacion/${idema}`,
      options,
    );
    return data;
  }

  async stationInventory(options: RequestOptions = {}): Promise<StationInventoryEntry[]> {
    const { data } = await this.transport.request<StationInventoryEntry[]>(
      "/valores/climatologicos/inventarioestaciones/todasestaciones",
      options,
    );
    return data;
  }
}

function assertIdema(idema: string): void {
  if (!IDEMA_RE.test(idema)) {
    throw new AemetError(
      `Invalid station idema: ${JSON.stringify(idema)}. Expected 3-6 alphanumeric characters.`,
    );
  }
}

function assertYear(value: number | string, field: string): number {
  const str = String(value);
  if (!YEAR_RE.test(str)) {
    throw new AemetError(`Invalid ${field}: ${JSON.stringify(value)}. Expected 4-digit year.`);
  }
  return Number.parseInt(str, 10);
}

function assertRange(from: string, to: string): void {
  const fromDate = parseAemetDate(from);
  const toDate = parseAemetDate(to);
  if (toDate.getTime() < fromDate.getTime()) {
    throw new AemetError(`to (${to}) must be >= from (${from}).`);
  }
  const days = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
  if (days > MAX_DAILY_RANGE_DAYS) {
    throw new AemetError(
      `Date range ${from} to ${to} spans ${Math.round(days)} days and exceeds AEMET's limit of ` +
        `6 months (${MAX_DAILY_RANGE_DAYS} days) for daily values. ` +
        `Request it in chunks of at most ${MAX_DAILY_RANGE_DAYS} days.`,
    );
  }
}

function parseAemetDate(value: string): Date {
  const iso = value.replace("UTC", "Z");
  return new Date(iso);
}
