import { browser } from "$app/environment";

/**
 * v8 entity-selection feature flag.
 *
 * While the v8 redesign (issue #504) is in flight, the new tabbed picker
 * lives behind the `?v8=1` URL parameter (mirrored to `localStorage`) so
 * the existing v7 entity-selection components stay the default render path
 * and the entire existing test suite keeps passing.
 *
 * The flag flips to default-on in PR #2 when the adaptive compatibility
 * overlay lands. The v7 components are removed in a third clean-up PR.
 */

const STORAGE_KEY = "dedx_picker_v8";

const initial = browser ? localStorage.getItem(STORAGE_KEY) === "1" : false;

export const isPickerV8 = $state({ value: initial });

/**
 * Initialise the v8 flag from the current URL. Called from the calculator
 * and plot pages on mount. URL `?v8=1` enables, `?v8=0` explicitly disables
 * (and clears localStorage); absence of the param leaves the localStorage
 * value in effect.
 */
export function initPickerV8FromUrl(searchParams: URLSearchParams): void {
  const param = searchParams.get("v8");
  if (param === null) return;
  isPickerV8.value = param === "1";
  if (!browser) return;
  if (isPickerV8.value) localStorage.setItem(STORAGE_KEY, "1");
  else localStorage.removeItem(STORAGE_KEY);
}
