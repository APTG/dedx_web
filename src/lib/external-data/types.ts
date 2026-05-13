/**
 * Core types for external .webdedx Zarr stores.
 * See docs/04-feature-specs/external-data.md and
 * docs/04-feature-specs/shareable-urls-formal.md §2.
 */

export type ExternalSourceLabel = string;
export type ExternalEntityLocalId = string;

/**
 * A validated external entity reference in the form `ext:{label}:{localId}`.
 * Both components match /^[A-Za-z0-9_-]+$/.
 */
export type ExtRef = `ext:${ExternalSourceLabel}:${ExternalEntityLocalId}`;

/** A built-in numeric entity ID or an external entity reference. */
export type EntityId = number | ExtRef;

/** One external data source declared via `extdata={label}:{url}` in the URL. */
export interface ExternalSourceDescriptor {
  label: ExternalSourceLabel;
  /** The decoded URL for the Zarr v3 .webdedx store root. */
  url: string;
}

export type ExternalDataUrlErrorType = "duplicate-label" | "invalid-label";

export interface ExternalDataUrlError {
  type: ExternalDataUrlErrorType;
  label: string;
}

export interface ParsedExtdataParams {
  sources: ExternalSourceDescriptor[];
  errors: ExternalDataUrlError[];
}
