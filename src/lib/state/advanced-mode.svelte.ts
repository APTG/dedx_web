import { browser } from "$app/environment";

export const isAdvancedMode = $state({ value: false });

export function toggleAdvancedMode(): void {
  isAdvancedMode.value = !isAdvancedMode.value;
  if (browser) {
    if (isAdvancedMode.value) localStorage.setItem("dedx_advanced_mode", "1");
    else localStorage.removeItem("dedx_advanced_mode");
  }
}

export function initAdvancedModeFromUrl(searchParams: URLSearchParams): void {
  isAdvancedMode.value = searchParams.get("mode") === "advanced";
}
