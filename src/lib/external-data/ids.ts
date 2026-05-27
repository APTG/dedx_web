import type { ExtRef, EntityId } from "./types.js";

/** Regex for external source labels and entity local IDs per the formal URL grammar. */
const IDENTIFIER_RE = /^[A-Za-z0-9_-]+$/;

export function isExternalSourceLabel(value: string): boolean {
  return IDENTIFIER_RE.test(value);
}

export function isExternalEntityLocalId(value: string): boolean {
  return IDENTIFIER_RE.test(value);
}

export function isExtRef(value: unknown): value is ExtRef {
  if (typeof value !== "string") return false;
  if (!value.startsWith("ext:")) return false;
  const rest = value.slice(4);
  const colonIdx = rest.indexOf(":");
  if (colonIdx <= 0) return false;
  const label = rest.slice(0, colonIdx);
  const localId = rest.slice(colonIdx + 1);
  return IDENTIFIER_RE.test(label) && IDENTIFIER_RE.test(localId);
}

/**
 * Parse a string as an ext-ref.
 * Returns { label, localId } if valid, null otherwise.
 */
export function parseExtRef(value: string): { label: string; localId: string } | null {
  if (!value.startsWith("ext:")) return null;
  const rest = value.slice(4);
  const colonIdx = rest.indexOf(":");
  if (colonIdx <= 0) return null;
  const label = rest.slice(0, colonIdx);
  const localId = rest.slice(colonIdx + 1);
  if (!IDENTIFIER_RE.test(label) || !IDENTIFIER_RE.test(localId)) return null;
  return { label, localId };
}

export function formatExtRef(label: string, localId: string): ExtRef {
  if (!isExternalSourceLabel(label)) {
    throw new Error(`Invalid external source label: "${label}"`);
  }
  if (!isExternalEntityLocalId(localId)) {
    throw new Error(`Invalid external entity local ID: "${localId}"`);
  }
  return `ext:${label}:${localId}` as ExtRef;
}

/**
 * Parse a URL param value as an EntityId.
 * Accepts positive integers (built-in) and `ext:{label}:{localId}` strings (external).
 * Returns null for invalid or zero/negative integers.
 */
export function parseEntityId(value: string | null): EntityId | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return n > 0 ? n : null;
  }
  const parsed = parseExtRef(trimmed);
  if (parsed) return `ext:${parsed.label}:${parsed.localId}` as ExtRef;
  return null;
}

export function formatEntityId(id: EntityId): string {
  return String(id);
}

/**
 * Parse a comma-separated list of entity IDs (mixed built-in and external).
 * Invalid entries are silently dropped.
 */
export function parseEntityIdList(raw: string): EntityId[] {
  return raw
    .split(",")
    .map((s) => parseEntityId(s.trim()))
    .filter((id): id is EntityId => id !== null);
}

export function formatEntityIdList(ids: EntityId[]): string {
  return ids.map(formatEntityId).join(",");
}

/**
 * Resolve a built-in or external entity ID to its local ID inside a named
 * external source. Returns null if the entity is not covered by that source.
 *
 * - External IDs (`ext:label:localId`) yield their `localId` iff `label` matches.
 * - Built-in numeric IDs use `refMap` (e.g. `externalRefsForBuiltinParticle`)
 *   to find an `ext:label:…` reference whose label matches.
 */
export function resolveExtLocalIdForLabel(
  entityId: number | string,
  label: string,
  refMap: Map<number, string[]> | Map<number | string, string[]>,
): string | null {
  if (typeof entityId === "string" && entityId.startsWith("ext:")) {
    const parsed = parseExtRef(entityId);
    return parsed && parsed.label === label ? parsed.localId : null;
  }
  if (typeof entityId === "number") {
    const refs = (refMap as Map<number, string[]>).get(entityId) ?? [];
    for (const ref of refs) {
      const p = parseExtRef(ref);
      if (p && p.label === label) return p.localId;
    }
  }
  return null;
}
