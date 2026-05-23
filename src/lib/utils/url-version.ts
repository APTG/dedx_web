export const CURRENT_URL_MAJOR = 2;
export const MIN_SUPPORTED_URL_MAJOR = 1;

export type VersionNegotiationResult =
  | { status: "ok" }
  | { status: "mismatch"; version: number | string };

export function negotiateVersion(version: string | null | undefined): VersionNegotiationResult {
  if (version === null || version === undefined) return { status: "ok" };
  if (!/^\d+$/.test(version)) return { status: "mismatch", version: version || "invalid" };

  const v = Number(version);
  if (!Number.isSafeInteger(v) || v < MIN_SUPPORTED_URL_MAJOR) {
    return { status: "mismatch", version: v };
  }
  if (v === CURRENT_URL_MAJOR) return { status: "ok" };
  return { status: "mismatch", version: v };
}
