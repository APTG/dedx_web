/**
 * Error types for external .webdedx store loading.
 * Classified codes allow the UI to show targeted recovery actions.
 */

export type ExternalDataErrorCode =
  | "network-error" // fetch failed (DNS, network unreachable)
  | "not-found" // HTTP 404
  | "cors-error" // CORS blocked
  | "invalid-format" // zarr.json valid JSON but wrong magic / node_type
  | "validation-error" // metadata fails spec rules
  | "unsupported-version" // formatVersion > supported max
  | "size-limit" // root metadata exceeds size limit
  | "timeout"; // request timeout

export class ExternalDataError extends Error {
  readonly code: ExternalDataErrorCode;
  readonly details?: string;

  constructor(code: ExternalDataErrorCode, message: string, details?: string) {
    super(message);
    this.name = "ExternalDataError";
    this.code = code;
    this.details = details;
  }
}
