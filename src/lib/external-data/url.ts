import type {
  ExternalSourceDescriptor,
  ExternalDataUrlError,
  ParsedExtdataParams,
} from "./types.js";
import { isExternalSourceLabel } from "./ids.js";

/**
 * Parse all `extdata` query parameters in declaration order.
 *
 * Rules:
 * - Split each value on the first literal colon to get `{label}:{url}`.
 *   URLSearchParams already percent-decodes the value, so the URL portion
 *   is the fully decoded URL string.
 * - Labels must match /^[A-Za-z0-9_-]+$/.
 * - Duplicate labels are a parse error: all occurrences are dropped and an
 *   error is recorded. This prevents ambiguous label bindings.
 * - Invalid labels are silently dropped with an error recorded.
 */
export function parseExtdataParams(params: URLSearchParams): ParsedExtdataParams {
  const sources: ExternalSourceDescriptor[] = [];
  const errors: ExternalDataUrlError[] = [];

  // Count only syntactically valid labels for duplicate detection. Invalid
  // labels cannot bind to entity refs and are reported per occurrence below.
  const labelCounts = new Map<string, number>();
  for (const value of params.getAll("extdata")) {
    const colonIdx = value.indexOf(":");
    if (colonIdx <= 0) continue;
    const label = value.slice(0, colonIdx);
    if (!isExternalSourceLabel(label)) continue;
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  // Identify duplicate labels and pre-populate errors.
  const reportedDuplicates = new Set<string>();
  for (const [label, count] of labelCounts) {
    if (count > 1) {
      reportedDuplicates.add(label);
      errors.push({ type: "duplicate-label", label });
    }
  }

  // Second pass: collect valid, non-duplicate sources.
  for (const value of params.getAll("extdata")) {
    const colonIdx = value.indexOf(":");
    if (colonIdx <= 0) {
      errors.push({ type: "invalid-label", label: "" });
      continue;
    }
    const label = value.slice(0, colonIdx);
    const url = value.slice(colonIdx + 1);

    if (!isExternalSourceLabel(label)) {
      errors.push({ type: "invalid-label", label });
      continue;
    }

    if (reportedDuplicates.has(label)) {
      // All occurrences of a duplicate label are dropped.
      continue;
    }

    sources.push({ label, url });
  }

  return { sources, errors };
}

/**
 * Append extdata params to URLSearchParams.
 * Stores the URL as-is (decoded); the query string serializer is responsible
 * for percent-encoding the URL portion (see `externalDataQuerySegments`).
 */
export function appendExtdataParams(
  params: URLSearchParams,
  sources: ExternalSourceDescriptor[],
): void {
  for (const source of sources) {
    params.append("extdata", `${source.label}:${source.url}`);
  }
}

/**
 * Return raw query string segments for extdata in canonical form:
 *   `extdata={label}:{encodeURIComponent(url)}`
 *
 * The label separator colon is literal. The URL is percent-encoded so that
 * its own colons (e.g. `https:`) never appear literally in the query string
 * — which is required by the formal URL grammar §2 `extdata-pair` rule.
 *
 * File-based sources (blob: URLs or empty-string URLs for FSDH stores) are
 * ephemeral and not shareable via URL — they are silently excluded.
 */
export function externalDataQuerySegments(sources: ExternalSourceDescriptor[]): string[] {
  return sources
    .filter((s) => s.url.startsWith("http://") || s.url.startsWith("https://"))
    .map((s) => `extdata=${s.label}:${encodeURIComponent(s.url)}`);
}
