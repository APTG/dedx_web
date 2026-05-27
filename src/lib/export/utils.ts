/** Convert a display name to a lowercase underscore-separated slug. */
export function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_");
}
