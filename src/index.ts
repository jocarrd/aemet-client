export { AemetClient, type AemetClientConfig } from "./client.js";
export { Transport, type TransportConfig, type RequestOptions, type EnvelopeResult, type FetchLike, DEFAULT_BASE_URL } from "./transport.js";
export {
  AemetError,
  AemetAuthError,
  AemetNotFoundError,
  AemetRateLimitError,
  AemetServerError,
  AemetNetworkError,
  AemetInvalidResponseError,
  type AemetErrorContext,
} from "./errors.js";
export { type AemetEnvelope, isAemetEnvelope } from "./types/envelope.js";
export { Resource } from "./resources/base.js";
export {
  PredictionResource,
  type MunicipioCode,
  type ForecastOrigin,
  type PeriodValue,
  type PeriodDescribedValue,
  type WindEntry,
  type TemperatureEntry,
  type MunicipalDailyForecast,
  type MunicipalDailyForecastDay,
  type MunicipalHourlyForecast,
  type HourlyForecastDay,
  type HourlyHumidityEntry,
} from "./resources/prediction/index.js";
export {
  ObservationResource,
  type IdemaCode,
  type StationObservation,
} from "./resources/observation/index.js";
export {
  WarningsResource,
  parseCapXml,
  parseTar,
  isGzip,
  gunzip,
  CAP_AREAS,
  type TarEntry,
  type CapAlert,
  type CapInfo,
  type CapArea,
  type CapValuePair,
  type CapStatus,
  type CapMsgType,
  type CapScope,
  type CapUrgency,
  type CapSeverity,
  type CapCertainty,
  type CapAreaCode,
  type CapDocument,
} from "./resources/warnings/index.js";
export {
  ClimatologyResource,
  type ClimatologyDaily,
  type ClimatologyMonthly,
  type ClimatologyNormal,
  type StationInventoryEntry,
} from "./resources/climatology/index.js";
export {
  BeachResource,
  type BeachForecast,
  type BeachForecastDay,
  type PlayaCode,
} from "./resources/beach/index.js";
export {
  MountainResource,
  MOUNTAIN_AREAS,
  type MountainArea,
  type MountainPeriod,
  type MountainForecast,
  type MountainForecastDay,
  type MountainForecastEntry,
} from "./resources/mountain/index.js";
export {
  MaritimeResource,
  type HighSeasArea,
  type CoastalArea,
  type MaritimeForecast,
  type MaritimeForecastSubzone,
} from "./resources/maritime/index.js";
export {
  RadarResource,
  REGIONAL_RADARS,
  type RegionalRadarCode,
  type RadarImage,
} from "./resources/radar/index.js";
export { toAemetDate, parseSpanishNumber, type AemetDateInput } from "./utils/date.js";
