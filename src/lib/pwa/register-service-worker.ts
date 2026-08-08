import { base } from "$app/paths";
import { dev } from "$app/environment";
import { updateAvailable } from "./update-state.svelte";

let waitingWorker: ServiceWorker | null = null;

// Registers the SW ourselves (kit.serviceWorker.register is false in
// svelte.config.js) so we can surface an "update available" prompt instead of
// swapping cached assets under a running session — see the stale-WASM risk
// noted in docs/09-non-functional-requirements.md §3.1.
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register(`${base}/service-worker.js`, { type: dev ? "module" : "classic" })
    .then((registration) => {
      if (registration.waiting && registration.active) {
        waitingWorker = registration.waiting;
        updateAvailable.value = true;
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorker = installing;
            updateAvailable.value = true;
          }
        });
      });
    })
    .catch(() => {
      // Offline support degrades gracefully without a service worker.
    });
}

export function applyServiceWorkerUpdate(): void {
  if (!waitingWorker) return;
  // Only listen for controllerchange (and only reload) once the user has
  // actually asked to update — a listener registered unconditionally at
  // startup would also fire (and reload the page) the very first time
  // clients.claim() hands this page its initial controller, which isn't a
  // real update.
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      window.location.reload();
    },
    { once: true },
  );
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}
