import { XMLParser } from "fast-xml-parser";
import { AemetInvalidResponseError } from "../../errors.js";
import type {
  CapAlert,
  CapArea,
  CapCertainty,
  CapInfo,
  CapMsgType,
  CapScope,
  CapSeverity,
  CapStatus,
  CapUrgency,
  CapValuePair,
} from "./types.js";

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
});

export function parseCapXml(xml: string): CapAlert {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const alert = doc["alert"] as Record<string, unknown> | undefined;
  if (!alert) {
    throw new AemetInvalidResponseError("CAP document is missing <alert> root.");
  }
  return {
    identifier: requireString(alert, "identifier"),
    sender: requireString(alert, "sender"),
    sent: requireString(alert, "sent"),
    status: requireString(alert, "status") as CapStatus,
    msgType: requireString(alert, "msgType") as CapMsgType,
    scope: requireString(alert, "scope") as CapScope,
    ...optionalString(alert, "source", "source"),
    ...optionalString(alert, "restriction", "restriction"),
    ...optionalString(alert, "addresses", "addresses"),
    code: toArray(alert["code"]).map(String),
    ...optionalString(alert, "note", "note"),
    ...optionalString(alert, "references", "references"),
    ...optionalString(alert, "incidents", "incidents"),
    info: toArray(alert["info"]).map(toInfo),
  };
}

function toInfo(raw: unknown): CapInfo {
  const info = raw as Record<string, unknown>;
  return {
    language: stringOr(info["language"], "es-ES"),
    category: toArray(info["category"]).map(String),
    event: stringOr(info["event"], ""),
    responseType: toArray(info["responseType"]).map(String),
    urgency: stringOr(info["urgency"], "Unknown") as CapUrgency,
    severity: stringOr(info["severity"], "Unknown") as CapSeverity,
    certainty: stringOr(info["certainty"], "Unknown") as CapCertainty,
    ...optionalString(info, "audience", "audience"),
    eventCode: toArray(info["eventCode"]).map(toValuePair),
    ...optionalString(info, "effective", "effective"),
    ...optionalString(info, "onset", "onset"),
    ...optionalString(info, "expires", "expires"),
    senderName: stringOr(info["senderName"], ""),
    headline: stringOr(info["headline"], ""),
    description: stringOr(info["description"], ""),
    ...optionalString(info, "instruction", "instruction"),
    ...optionalString(info, "web", "web"),
    ...optionalString(info, "contact", "contact"),
    parameters: toArray(info["parameter"]).map(toValuePair),
    area: toArray(info["area"]).map(toArea),
  };
}

function toArea(raw: unknown): CapArea {
  const area = raw as Record<string, unknown>;
  const out: CapArea = {
    areaDesc: stringOr(area["areaDesc"], ""),
    polygon: toArray(area["polygon"]).map(String),
    circle: toArray(area["circle"]).map(String),
    geocode: toArray(area["geocode"]).map(toValuePair),
  };
  const altitude = numberOrUndefined(area["altitude"]);
  if (altitude !== undefined) out.altitude = altitude;
  const ceiling = numberOrUndefined(area["ceiling"]);
  if (ceiling !== undefined) out.ceiling = ceiling;
  return out;
}

function toValuePair(raw: unknown): CapValuePair {
  const pair = raw as Record<string, unknown>;
  return {
    valueName: stringOr(pair["valueName"], ""),
    value: stringOr(pair["value"], ""),
  };
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v === "string") return v;
  throw new AemetInvalidResponseError(`CAP document is missing required field <${key}>.`);
}

function optionalString<K extends string>(
  obj: Record<string, unknown>,
  key: string,
  outKey: K,
): { [P in K]: string } | Record<string, never> {
  const v = obj[key];
  if (typeof v === "string" && v.length > 0) return { [outKey]: v } as { [P in K]: string };
  return {};
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toArray<T = unknown>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
