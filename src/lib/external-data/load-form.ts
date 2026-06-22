/**
 * Pure form logic for the "Load external data source" modal: URL/label
 * validation, label derivation/uniqueness, recents persistence, and drop
 * parsing. The component owns presentation and the async load calls; this
 * module owns everything testable without a DOM.
 */

const RECENTS_KEY = "webdedx.externalRecents.v1";
const MAX_RECENTS = 5;
const LABEL_RE = /^[A-Za-z0-9_-]+$/;
/** Matches https:// … .webdedx with optional trailing slash. */
const HTTPS_URL_RE = /^https:\/\/.+\.webdedx\/?$/i;
const LOCALHOST_HTTP_URL_RE =
  /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/.+\.webdedx\/?$/i;

export interface ExternalRecent {
  url: string;
  label: string;
  name: string;
  loadedAt: number;
}

/** Collapse arbitrary text into a valid `[A-Za-z0-9_-]` label (max 32 chars). */
export function sanitizeLabel(raw: string): string {
  const clean = raw
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean.slice(0, 32) || "ext";
}

/** Derive a default label from a URL's last path segment (minus `.webdedx`). */
export function labelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const stem = u.pathname.split("/").filter(Boolean).pop() ?? "";
    return sanitizeLabel(stem.replace(/\.webdedx$/i, ""));
  } catch {
    return "ext";
  }
}

/** Validate a label: required, charset, and not already loaded. */
export function validateLabelValue(value: string, existingLabels: Set<string>): string | null {
  if (!value.trim()) return "Label is required";
  if (!LABEL_RE.test(value)) return "Use only letters, digits, - and _";
  if (existingLabels.has(value)) return `"${value}" is already loaded`;
  return null;
}

/** Validate an external store URL (https://… .webdedx, or http://localhost). */
export function validateExternalUrl(url: string): string | null {
  if (!HTTPS_URL_RE.test(url) && !LOCALHOST_HTTP_URL_RE.test(url)) {
    return "Must be https://… .webdedx (http://localhost allowed)";
  }
  return null;
}

/**
 * Find an unused label by checking `base` first, then appending `-2`, `-3`, …
 * Falls back to `base` itself if all candidates up to `-99` are taken.
 */
export function nextAvailableLabel(base: string, existingLabels: Set<string>): string {
  if (!existingLabels.has(base)) return base;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    if (!existingLabels.has(candidate)) return candidate;
  }
  return base;
}

/** First http(s) URL from dropped text (uri-list/plain), or null. */
export function firstDroppedUrl(uriList: string, text: string): string | null {
  const dropped = (uriList || text || "").trim().split("\n")[0]?.trim() ?? "";
  return /^https?:\/\//i.test(dropped) ? dropped : null;
}

/**
 * Insert `entry` at the head of `existing`, de-duplicating by URL and capping
 * the list at `max`. Pure — does not touch localStorage.
 */
export function appendRecent(
  existing: ExternalRecent[],
  entry: ExternalRecent,
  max = MAX_RECENTS,
): ExternalRecent[] {
  return [entry, ...existing.filter((r) => r.url !== entry.url)].slice(0, max);
}

/** Load the recents list from localStorage (empty on any failure). */
export function loadRecents(): ExternalRecent[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ExternalRecent[]) : [];
  } catch {
    return [];
  }
}

/**
 * Record a successful load: prepend it to the recents list, persist
 * (best-effort), and return the updated list for the component to display.
 */
export function recordRecent(url: string, label: string, name: string): ExternalRecent[] {
  const entry: ExternalRecent = { url, label, name, loadedAt: Date.now() };
  const updated = appendRecent(loadRecents(), entry);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
    } catch {
      // Best-effort persistence only — don't block a successful source load.
    }
  }
  return updated;
}
