import { browser } from "$app/environment";

/**
 * tabbed picker mode: "basic" or "advanced".
 *
 * Drives what extra features the tabbed picker exposes (periodic-grid
 * scan view, Custom material sub-tab, inline multi-program list,
 * `⊞ explore compat` overlay link, advanced search operators).
 *
 * Mirrors `isAdvancedMode` for the rest of the app for now — kept as a
 * separate store so the tabbed picker UI can move independently of the global
 * advanced-options switch if product needs diverge.
 */

export type PickerMode = "basic" | "advanced";

const STORAGE_KEY = "webdedx.pickerMode";

function hydrate(): PickerMode {
  if (!browser) return "basic";
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "advanced" ? "advanced" : "basic";
}

export const pickerMode = $state<{ value: PickerMode }>({ value: hydrate() });

export function setPickerMode(mode: PickerMode): void {
  pickerMode.value = mode;
  if (!browser) return;
  if (mode === "advanced") localStorage.setItem(STORAGE_KEY, "advanced");
  else localStorage.removeItem(STORAGE_KEY);
}

export function togglePickerMode(): void {
  setPickerMode(pickerMode.value === "advanced" ? "basic" : "advanced");
}

/**
 * Initialise the picker mode from the URL. `?mode=advanced` flips on,
 * `?mode=basic` flips off. URL takes precedence over localStorage when
 * present so shared share-links keep their context.
 */
export function initPickerModeFromUrl(searchParams: URLSearchParams): void {
  const param = searchParams.get("mode");
  if (param === null) return;
  setPickerMode(param === "advanced" ? "advanced" : "basic");
}
