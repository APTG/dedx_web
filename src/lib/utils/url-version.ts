export const CURRENT_URL_MAJOR = 3;
/**
 * Lowest URL major the parser understands. v1 links are no longer migrated;
 * they are rejected by `negotiateVersion` and the user sees the unsupported-link
 * banner with a one-click "Load defaults" (issue #477).
 *
 * v2 and v3 differ only in the list-item separator (`,` → `~`, issue #672) and
 * the decoders accept both, so the whole `[MIN, CURRENT]` range hydrates
 * natively — a v2 link shared before #672 keeps working and is rewritten to the
 * canonical v3 (`~`) form on load.
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
  if (!Number.isSafeInteger(v)) return { status: "mismatch", version: v };
  // Any major within the supported range hydrates natively; below MIN (v1) or
  // above CURRENT (a future schema) is unsupported.
  if (v >= MIN_SUPPORTED_URL_MAJOR && v <= CURRENT_URL_MAJOR) return { status: "ok" };
  return { status: "mismatch", version: v };
}

/**
 * Version migration seam.
 *
 * v2 → v3 needs no token rewriting: the only change is the list-item separator
 * (`,` → `~`, issue #672) and the decoders read both forms, so loading a v2 link
 * yields the same state and `replaceState` rewrites it to canonical v3. This
 * stays the identity and remains the single place a future `vN → vN+1` step that
 * *does* need rewriting would be registered, without touching the resolvers
 * (issue #477). `negotiateVersion` gates which inputs ever reach it.
 */
export function migrateUrl<T>(fromMajor: number, toMajor: number, tokens: T): T {
  if (fromMajor === toMajor) return tokens;
  // Future majors register their migration steps here, chaining fromMajor up to
  // toMajor. Until then, only the current major is accepted upstream.
  return tokens;
}
