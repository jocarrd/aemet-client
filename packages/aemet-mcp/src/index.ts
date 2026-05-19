export {
  createServer,
  SERVER_NAME,
  SERVER_VERSION,
  type CreateServerOptions,
} from "./server.js";
export {
  resolveMunicipality,
  resolveMunicipalityByCoords,
  resolveCapArea,
  ResolutionError,
  normalize,
  type ResolvedMunicipality,
  type ResolvedCapArea,
} from "./resolve.js";
