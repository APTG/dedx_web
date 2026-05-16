/**
 * Zarrita-based loader for .webdedx Zarr v3 stores.
 *
 * Access pattern (proven in prototypes/extdata-formats/browser/src/main.ts):
 *   const store = new FetchStore(url);
 *   const group = await open(root(store), { kind: "group" });
 *   const arr   = await open(root(store).resolve(`${program}/stp`), { kind: "array" });
 *   const slice = await get(arr, [particleIdx, materialIdx, null]);
 *
 * zarrita handles ZEP2 sharding (HEAD + Range GETs) and LZ4 codec
 * transparently — no manual registration needed.
 */

import { FetchStore, open, get, root } from "zarrita";
import type { ExternalStoreMetadata } from "./schema.js";
import type { ExternalSourceDescriptor } from "./types.js";
import { ExternalDataError } from "./errors.js";
import { validateRootAttrs } from "./validation.js";

/**
 * Load and validate the root metadata of a .webdedx store.
 *
 * Fetches {url}/zarr.json, validates it against the webdedx schema,
 * then probes for csda_range arrays to set hasCsdaRange.
 */
export async function loadStoreMetadata(
  descriptor: ExternalSourceDescriptor,
): Promise<ExternalStoreMetadata> {
  const { label, url } = descriptor;
  const store = new FetchStore(url);

  // Open root group — zarrita fetches `{url}/zarr.json`.
  let rootGroup: Awaited<ReturnType<typeof open>>;
  try {
    rootGroup = await open(root(store), { kind: "group" });
  } catch (err) {
    throw classifyLoadError(err, url);
  }

  const attrs = rootGroup.attrs as Record<string, unknown>;
  const metadata = validateRootAttrs(attrs, label, url);

  // Probe whether csda_range arrays are present for each program.
  // We open the first program's csda_range array; if it exists, hasCsdaRange = true.
  // This avoids fetching actual shard data during metadata load.
  let hasCsdaRange = false;
  for (const program of metadata.programs) {
    try {
      await open(root(store).resolve(`${program.id}/csda_range`), { kind: "array" });
      hasCsdaRange = true;
      break;
    } catch {
      // Array does not exist — missing csda_range is valid per spec v6.
    }
  }
  metadata.hasCsdaRange = hasCsdaRange;

  return metadata;
}

/**
 * Fetch a 1-D STP slice for a specific (program, particle, material) combination.
 * Returns a Float32Array of length n_energies in the source's stpUnit.
 *
 * The caller is responsible for unit conversion (see units.ts).
 */
export async function loadStpSlice(
  url: string,
  programId: string,
  particleIndex: number,
  materialIndex: number,
): Promise<Float32Array> {
  const store = new FetchStore(url);
  let arr: Awaited<ReturnType<typeof open>>;
  try {
    arr = await open(root(store).resolve(`${programId}/stp`), { kind: "array" });
  } catch (err) {
    throw classifyLoadError(err, `${url}/${programId}/stp`);
  }
  try {
    const chunk = await get(arr, [particleIndex, materialIndex, null]);
    return chunk.data as Float32Array;
  } catch (err) {
    throw classifyLoadError(err, `${url}/${programId}/stp shard`);
  }
}

/**
 * Fetch a 1-D CSDA range slice. Returns null if the csda_range array is absent.
 */
export async function loadCsdaSlice(
  url: string,
  programId: string,
  particleIndex: number,
  materialIndex: number,
): Promise<Float32Array | null> {
  const store = new FetchStore(url);
  let arr: Awaited<ReturnType<typeof open>>;
  try {
    arr = await open(root(store).resolve(`${programId}/csda_range`), { kind: "array" });
  } catch {
    // Array absent — valid for STP-only stores.
    return null;
  }
  try {
    const chunk = await get(arr, [particleIndex, materialIndex, null]);
    return chunk.data as Float32Array;
  } catch (err) {
    throw classifyLoadError(err, `${url}/${programId}/csda_range shard`);
  }
}

/**
 * Map a raw fetch or zarrita error to a classified ExternalDataError.
 */
function classifyLoadError(err: unknown, context: string): ExternalDataError {
  if (err instanceof ExternalDataError) return err;

  const msg = err instanceof Error ? err.message : String(err);

  // HTTP 404 or zarrita NotFoundError ("Not found: ...")
  if (
    msg.includes("404") ||
    msg.includes("Not Found") ||
    (err instanceof Error && err.name === "NotFoundError") ||
    msg.startsWith("Not found:")
  ) {
    return new ExternalDataError("not-found", `External store not found at ${context}`, msg);
  }

  // CORS / CORS-related fetch errors have distinct messages in browsers
  if (msg.toLowerCase().includes("cors") || msg.toLowerCase().includes("cross-origin")) {
    return new ExternalDataError("cors-error", `CORS error loading ${context}`, msg);
  }

  // Network-level errors (failed to fetch, etc.)
  if (
    msg.toLowerCase().includes("failed to fetch") ||
    msg.toLowerCase().includes("network") ||
    msg.toLowerCase().includes("connection")
  ) {
    return new ExternalDataError("network-error", `Network error loading ${context}`, msg);
  }

  return new ExternalDataError("network-error", `Failed to load ${context}: ${msg}`, msg);
}

// Re-export for convenience — callers only need to import from loader.
export { ExternalDataError } from "./errors.js";
export type { ExternalStoreMetadata } from "./schema.js";
