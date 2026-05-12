export const CURRENT_URL_MAJOR = 1;
export const MIN_SUPPORTED_URL_MAJOR = 1;

export type VersionNegotiationResult = { status: "ok" } | { status: "mismatch"; version: number };

export function negotiateVersion(version: number | undefined): VersionNegotiationResult {
  const v = version ?? CURRENT_URL_MAJOR;
  if (v === CURRENT_URL_MAJOR) return { status: "ok" };
  return { status: "mismatch", version: v };
}
