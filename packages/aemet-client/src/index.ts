export { AemetClient, type AemetClientConfig } from "./client.js";
export {
  Transport,
  type TransportConfig,
  type RequestOptions,
  type EnvelopeResult,
  type FetchLike,
  DEFAULT_BASE_URL,
} from "./transport.js";
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
  type ClimatologyNormalField,
  type ClimatologyNormalStat,
  type ClimatologyNormalVariable,
  type StationInventoryEntry,
} from "./resources/climatology/index.js";
export {
  BeachResource,
  BeachForecastUnavailableError,
  type BeachForecast,
  type BeachForecastDay,
  type BeachForecastOrigin,
  type BeachMorningAfternoon,
  type BeachDailyValue,
  type BeachThermalSensation,
  type PlayaCode,
} from "./resources/beach/index.js";
export {
  MountainResource,
  MOUNTAIN_AREAS,
  type MountainArea,
  type MountainDay,
  type MountainBulletin,
  type MountainBulletinSection,
  type MountainBulletinItem,
  type MountainBulletinParagraph,
  type MountainOrigin,
} from "./resources/mountain/index.js";
export {
  MaritimeResource,
  HIGH_SEAS_AREAS,
  COASTAL_AREAS,
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
export {
  SatelliteResource,
  SATELLITE_PRODUCTS,
  type SatelliteProduct,
  type SatelliteImage,
} from "./resources/satellite/index.js";
export {
  MapsResource,
  SIGNIFICANT_MAP_AREAS,
  SIGNIFICANT_MAP_PERIODS,
  type SignificantMapArea,
  type SignificantMapPeriod,
  type MapImage,
} from "./resources/maps/index.js";
export {
  AntarcticaResource,
  ANTARCTICA_STATIONS,
  type AntarcticaStation,
  type AntarcticaObservation,
} from "./resources/antarctica/index.js";
export {
  AirQualityResource,
  POLLUTION_STATIONS,
  type PollutionStation,
  type PollutionReading,
  type PollutionMeasurement,
} from "./resources/airQuality/index.js";
export { toAemetDate, parseSpanishNumber, type AemetDateInput } from "./utils/date.js";
export {
  haversine,
  findNearest,
  findNearestN,
  parseAemetCoordinate,
  type GeoPoint,
  type NearestMatch,
} from "./utils/geo.js";
export { MemoryCacheAdapter, type CacheAdapter, type CacheConfig } from "./cache/index.js";
