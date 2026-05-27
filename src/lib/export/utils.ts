/** Convert a display name to a filesystem-safe lowercase slug. */
export function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_");
}
