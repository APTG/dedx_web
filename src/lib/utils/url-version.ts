export const CURRENT_URL_MAJOR = 2;
/**
 * Lowest URL major the parser understands. v1 links are no longer migrated;
 * they are rejected by `negotiateVersion` and the user sees the unsupported-link
 * banner with a one-click "Load defaults" (issue #477).
 */
export const MIN_SUPPORTED_URL_MAJOR = 2;

export type VersionNegotiationResult =
  | { status: "ok" }
  | { status: "mismatch"; version: number | string };

export function negotiateVersion(version: string | null | undefined): VersionNegotiationResult {
  // Absent urlv is treated leniently as the current schema (legacy links that
  // predate versioning); only an explicit, out-of-range major is rejected.
  if (version === null || version === undefined) return { status: "ok" };
  if (!/^\d+$/.test(version)) return { status: "mismatch", version: version || "invalid" };

  const v = Number(version);
  if (!Number.isSafeInteger(v) || v < MIN_SUPPORTED_URL_MAJOR) {
    return { status: "mismatch", version: v };
  }
  if (v === CURRENT_URL_MAJOR) return { status: "ok" };
  return { status: "mismatch", version: v };
}

/**
 * Version migration seam.
 *
 * No migration chain is defined yet: `MIN_SUPPORTED_URL_MAJOR === CURRENT_URL_MAJOR`,
 * so the only accepted major is the current one and this is the identity. It
 * exists as the single place a future `vN → vN+1` step would be registered,
 * so the bump can be wired in without touching the resolvers (issue #477,
 * acceptance criterion: "a migrateUrl stub exists and is wired into the
 * version-check path"). `negotiateVersion` gates which inputs ever reach it.
 */
export function migrateUrl<T>(fromMajor: number, toMajor: number, tokens: T): T {
  if (fromMajor === toMajor) return tokens;
  // Future majors register their migration steps here, chaining fromMajor up to
  // toMajor. Until then, only the current major is accepted upstream.
  return tokens;
}
