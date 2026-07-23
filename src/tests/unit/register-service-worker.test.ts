import { describe, test, expect, beforeEach, vi } from "vitest";

vi.mock("$app/paths", () => ({ base: "" }));
vi.mock("$app/environment", () => ({ dev: false }));

type Listener = (event: unknown) => void;

function createMockWorker() {
  const listeners = new Map<string, Listener[]>();
  return {
    state: "installing",
    postMessage: vi.fn(),
    addEventListener: vi.fn((type: string, cb: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), cb]);
    }),
    _fire(type: string) {
      for (const cb of listeners.get(type) ?? []) cb({});
    },
  };
}

function createMockRegistration({
  waiting = null,
  active = null,
}: {
  waiting?: ReturnType<typeof createMockWorker> | null;
  active?: object | null;
} = {}) {
  const listeners = new Map<string, Listener[]>();
  return {
    waiting,
    active,
    installing: null as ReturnType<typeof createMockWorker> | null,
    addEventListener: vi.fn((type: string, cb: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), cb]);
    }),
    _fire(type: string) {
      for (const cb of listeners.get(type) ?? []) cb({});
    },
  };
}

describe("registerServiceWorker (#881)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  test("does nothing when the browser has no serviceWorker support", async () => {
    vi.stubGlobal("navigator", {});
    const { registerServiceWorker } = await import("$lib/pwa/register-service-worker");
    const { updateAvailable } = await import("$lib/pwa/update-state.svelte");
    expect(() => registerServiceWorker()).not.toThrow();
    expect(updateAvailable.value).toBe(false);
  });

  test("registers service-worker.js as a classic script in production", async () => {
    const registration = createMockRegistration();
    const register = vi.fn().mockResolvedValue(registration);
    const swListeners = new Map<string, Listener[]>();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register,
        addEventListener: vi.fn((type: string, cb: Listener) => {
          swListeners.set(type, [...(swListeners.get(type) ?? []), cb]);
        }),
        controller: null,
      },
    });

    const { registerServiceWorker } = await import("$lib/pwa/register-service-worker");
    registerServiceWorker();
    await vi.waitFor(() => expect(register).toHaveBeenCalled());

    expect(register).toHaveBeenCalledWith("/service-worker.js", { type: "classic" });
  });

  test("an already-waiting worker at registration time sets updateAvailable", async () => {
    const waiting = createMockWorker();
    const registration = createMockRegistration({ waiting, active: {} });
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn(),
        controller: {},
      },
    });

    const { registerServiceWorker } = await import("$lib/pwa/register-service-worker");
    const { updateAvailable } = await import("$lib/pwa/update-state.svelte");
    registerServiceWorker();

    await vi.waitFor(() => expect(updateAvailable.value).toBe(true));
  });

  test("a newly-installed worker (existing controller) sets updateAvailable and can be applied", async () => {
    const installing = createMockWorker();
    const registration = createMockRegistration();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn(),
        controller: {}, // a controller already exists → this is an update, not first install
      },
    });

    const { registerServiceWorker, applyServiceWorkerUpdate } =
      await import("$lib/pwa/register-service-worker");
    const { updateAvailable } = await import("$lib/pwa/update-state.svelte");
    registerServiceWorker();
    await vi.waitFor(() => expect(registration.addEventListener).toHaveBeenCalled());

    registration.installing = installing;
    registration._fire("updatefound");
    installing.state = "installed";
    installing._fire("statechange");

    expect(updateAvailable.value).toBe(true);

    applyServiceWorkerUpdate();
    expect(installing.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  test("an installing worker with no existing controller (first install) does not set updateAvailable", async () => {
    const installing = createMockWorker();
    const registration = createMockRegistration();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn(),
        controller: null, // no controller yet → first install, not an update
      },
    });

    const { registerServiceWorker } = await import("$lib/pwa/register-service-worker");
    const { updateAvailable } = await import("$lib/pwa/update-state.svelte");
    registerServiceWorker();
    await vi.waitFor(() => expect(registration.addEventListener).toHaveBeenCalled());

    registration.installing = installing;
    registration._fire("updatefound");
    installing.state = "installed";
    installing._fire("statechange");

    expect(updateAvailable.value).toBe(false);
  });

  test("first-ever activation (clients.claim() on install) does not reload the page", async () => {
    // Regression guard: a controllerchange listener registered unconditionally
    // at startup would also fire — and reload — the moment clients.claim()
    // hands this page its very first controller, which is not a real update.
    const installing = createMockWorker();
    const registration = createMockRegistration();
    const swListeners = new Map<string, Listener[]>();
    const reload = vi.fn();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn((type: string, cb: Listener) => {
          swListeners.set(type, [...(swListeners.get(type) ?? []), cb]);
        }),
        controller: null,
      },
    });
    vi.stubGlobal("window", { location: { reload } });

    const { registerServiceWorker } = await import("$lib/pwa/register-service-worker");
    registerServiceWorker();
    await vi.waitFor(() => expect(registration.addEventListener).toHaveBeenCalled());

    registration.installing = installing;
    registration._fire("updatefound");
    installing.state = "installed";
    installing._fire("statechange");

    for (const cb of swListeners.get("controllerchange") ?? []) cb({});

    expect(reload).not.toHaveBeenCalled();
  });

  test("applyServiceWorkerUpdate reloads once controllerchange fires, and only once", async () => {
    const waiting = createMockWorker();
    const registration = createMockRegistration({ waiting, active: {} });
    const swListeners = new Map<string, { cb: Listener; once: boolean | undefined }[]>();
    const reload = vi.fn();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn((type: string, cb: Listener, options?: { once?: boolean }) => {
          swListeners.set(type, [...(swListeners.get(type) ?? []), { cb, once: options?.once }]);
        }),
        controller: {},
      },
    });
    vi.stubGlobal("window", { location: { reload } });

    const { registerServiceWorker, applyServiceWorkerUpdate } =
      await import("$lib/pwa/register-service-worker");
    registerServiceWorker();
    await vi.waitFor(() => expect(waiting).toBeTruthy());

    applyServiceWorkerUpdate();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    const fire = () => {
      for (const entry of swListeners.get("controllerchange") ?? []) entry.cb({});
      swListeners.set(
        "controllerchange",
        (swListeners.get("controllerchange") ?? []).filter((entry) => !entry.once),
      );
    };
    fire();
    fire();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
