export type {
  ExternalSourceLabel,
  ExternalEntityLocalId,
  ExtRef,
  EntityId,
  ExternalSourceDescriptor,
  ExternalDataUrlError,
  ExternalDataUrlErrorType,
  ParsedExtdataParams,
} from "./types.js";

export {
  isExternalSourceLabel,
  isExternalEntityLocalId,
  isExtRef,
  parseExtRef,
  formatExtRef,
  parseEntityId,
  formatEntityId,
  parseEntityIdList,
  formatEntityIdList,
} from "./ids.js";

export { parseExtdataParams, appendExtdataParams, externalDataQuerySegments } from "./url.js";

export type {
  ExternalEnergyUnit,
  ExternalStpUnit,
  ExternalCsdaUnit,
  ExternalProgramEntry,
  ExternalParticleEntry,
  ExternalMaterialEntry,
  ExternalStoreMetadata,
} from "./schema.js";

export { ExternalDataError } from "./errors.js";
export type { ExternalDataErrorCode } from "./errors.js";

export { validateRootAttrs } from "./validation.js";

export {
  energyToMev,
  convertEnergyGrid,
  stpToInternal,
  csdaToInternal,
  convertStpColumn,
  convertCsdaColumn,
} from "./units.js";

export { interpolate } from "./interpolation.js";
export type { InterpolationScale } from "./interpolation.js";

export { loadStoreMetadata, loadStpSlice, loadCsdaSlice } from "./loader.js";

export { ExternalDataService, externalDataService } from "./service.js";
export type { StpTableEntry, CsdaTableEntry, ExternalLookupResult } from "./service.js";
