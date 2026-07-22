type ClassDictionary = Record<string, unknown>;
type ClassArray = ClassValue[];
type ClassValue =
  string | number | bigint | boolean | null | undefined | ClassDictionary | ClassArray;

function flattenClass(value: ClassValue | null | undefined | false): string[] {
  if (value === null || value === undefined || value === false || value === true) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return [String(value)];
  }
  if (Array.isArray(value)) return value.flatMap(flattenClass);
  return Object.entries(value)
    .filter(([, enabled]) => enabled)
    .map(([className]) => className);
}

// shadcn-svelte/Bits UI `class` props use Svelte's broad ClassValue shape,
// including arrays and object maps, so normalize that shape before joining.
export function cn(...classes: (ClassValue | null | undefined | false)[]): string {
  return classes.flatMap(flattenClass).join(" ");
}

// Helper types used by shadcn-svelte component props.
export type WithoutChildren<T> = Omit<T, "children">;
export type WithoutChild<T> = Omit<T, "child">;
export type WithoutChildrenOrChild<T> = Omit<T, "children" | "child">;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};
