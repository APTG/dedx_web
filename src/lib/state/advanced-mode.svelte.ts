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
  if (searchParams.has("mode")) {
    // URL param takes precedence over localStorage when present in the URL.
    isAdvancedMode.value = searchParams.get("mode") === "advanced";
    if (browser) {
      if (isAdvancedMode.value) localStorage.setItem("dedx_advanced_mode", "1");
      else localStorage.removeItem("dedx_advanced_mode");
    }
  }
}
