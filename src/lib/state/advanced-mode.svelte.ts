import { browser } from "$app/environment";

// Hydrate from localStorage on module load so the persisted preference survives
// a page reload before the URL is parsed (avoids a flash of Basic mode on
// `?mode=advanced` share links).
const storedValue = browser ? localStorage.getItem("dedx_advanced_mode") === "1" : false;
export const isAdvancedMode = $state({ value: storedValue });

export function toggleAdvancedMode(): void {
  isAdvancedMode.value = !isAdvancedMode.value;
  if (browser) {
    if (isAdvancedMode.value) localStorage.setItem("dedx_advanced_mode", "1");
    else localStorage.removeItem("dedx_advanced_mode");
  }
}

export function initAdvancedModeFromUrl(searchParams: URLSearchParams): void {
  // Check for both `mode=advanced` (canonical) and `advanced=1` (legacy) URL params
  const modeParam = searchParams.get("mode");
  const advancedParam = searchParams.get("advanced");

  if (modeParam !== null || advancedParam !== null) {
    // URL param takes precedence over localStorage when present in the URL.
    isAdvancedMode.value = modeParam === "advanced" || advancedParam === "1";
    // Guard with `browser` in case this module is ever imported during SSR
    // (currently it is only called from a page component's $effect, but the
    // defensive check future-proofs the export).
    if (browser) {
      if (isAdvancedMode.value) localStorage.setItem("dedx_advanced_mode", "1");
      else localStorage.removeItem("dedx_advanced_mode");
    }
  }
}
