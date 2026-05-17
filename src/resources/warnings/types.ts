export type CapStatus = "Actual" | "Exercise" | "System" | "Test" | "Draft";
export type CapMsgType = "Alert" | "Update" | "Cancel" | "Ack" | "Error";
export type CapScope = "Public" | "Restricted" | "Private";
export type CapUrgency = "Immediate" | "Expected" | "Future" | "Past" | "Unknown";
export type CapSeverity = "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
export type CapCertainty = "Observed" | "Likely" | "Possible" | "Unlikely" | "Unknown";

export interface CapValuePair {
  valueName: string;
  value: string;
}

export interface CapArea {
  areaDesc: string;
  polygon: string[];
  circle: string[];
  geocode: CapValuePair[];
  altitude?: number;
  ceiling?: number;
}

export interface CapInfo {
  language: string;
  category: string[];
  event: string;
  responseType: string[];
  urgency: CapUrgency;
  severity: CapSeverity;
  certainty: CapCertainty;
  audience?: string;
  eventCode: CapValuePair[];
  effective?: string;
  onset?: string;
  expires?: string;
  senderName: string;
  headline: string;
  description: string;
  instruction?: string;
  web?: string;
  contact?: string;
  parameters: CapValuePair[];
  area: CapArea[];
}

export interface CapAlert {
  identifier: string;
  sender: string;
  sent: string;
  status: CapStatus;
  msgType: CapMsgType;
  scope: CapScope;
  source?: string;
  restriction?: string;
  addresses?: string;
  code: string[];
  note?: string;
  references?: string;
  incidents?: string;
  info: CapInfo[];
}

export interface CapDocument {
  filename: string;
  raw: string;
  alert: CapAlert;
}

export const CAP_AREAS = {
  esp: "esp",
  andalucia: "61",
  aragon: "62",
  asturias: "63",
  baleares: "64",
  canarias: "65",
  cantabria: "66",
  castillaLaMancha: "67",
  castillaYLeon: "68",
  cataluna: "69",
  ceutaMelilla: "70",
  extremadura: "71",
  galicia: "72",
  laRioja: "73",
  madrid: "74",
  murcia: "75",
  navarra: "76",
  paisVasco: "77",
  valencia: "78",
} as const;

export type CapAreaCode = (typeof CAP_AREAS)[keyof typeof CAP_AREAS] | (string & {});
