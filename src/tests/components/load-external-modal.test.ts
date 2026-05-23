import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/svelte";
import LoadExternalModal from "$lib/components/entity-selection/load-external-modal.svelte";
import { externalDataService } from "$lib/external-data/service";
import type { ExternalStoreMetadata } from "$lib/external-data/schema";

const metadataFixture: ExternalStoreMetadata = {
  label: "srim",
  url: "https://example.test/srim.webdedx",
  name: "SRIM dataset",
  programs: [{ id: "prog1", name: "Program 1" }],
  particles: [
    { id: "p", name: "Proton", symbol: "H", Z: 1, A: 1, atomicMass: 1.008, index: 0, pdgCode: 2212 },
  ],
  materials: [{ id: "water", name: "Water", density: 1.0, index: 0, linearUnitsAvailable: true }],
  energyGrid: [1, 10, 100],
  energyUnit: "MeV",
  stpUnit: "MeV·cm²/g",
  hasCsdaRange: false,
};

describe("LoadExternalModal", () => {
  const onLoad = vi.fn();
  const onCancel = vi.fn();
  const loadFromUrlSpy = vi.spyOn(externalDataService, "loadFromUrl");
  const loadFromDirectorySpy = vi.spyOn(externalDataService, "loadFromDirectory");

  async function cleanupDialogTimers() {
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  beforeEach(async () => {
    await cleanupDialogTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(async () => {
    await cleanupDialogTimers();
  });

  it("rejects non-localhost http URLs and loads uppercase HTTPS URLs", async () => {
    loadFromUrlSpy.mockResolvedValue(metadataFixture);
    render(LoadExternalModal, {
      props: {
        open: true,
        existingLabels: new Set<string>(),
        onLoad,
        onCancel,
      },
    });

    await fireEvent.input(screen.getByTestId("load-ext-url-input"), {
      target: { value: "http://example.test/srim.webdedx" },
    });
    await fireEvent.input(screen.getByTestId("load-ext-label-input"), { target: { value: "srim" } });
    await fireEvent.click(screen.getByTestId("load-ext-url-submit"));
    expect(screen.getByText("Must be https://… .webdedx (http://localhost allowed)")).toBeInTheDocument();

    await fireEvent.input(screen.getByTestId("load-ext-url-input"), {
      target: { value: "HTTPS://example.test/srim.webdedx" },
    });
    await fireEvent.click(screen.getByTestId("load-ext-url-submit"));
    expect(loadFromUrlSpy).toHaveBeenCalledWith("HTTPS://example.test/srim.webdedx", "srim");
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it("does not fail loading when recents persistence throws", async () => {
    loadFromUrlSpy.mockResolvedValue(metadataFixture);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    render(LoadExternalModal, {
      props: {
        open: true,
        existingLabels: new Set<string>(),
        onLoad,
        onCancel,
      },
    });

    await fireEvent.input(screen.getByTestId("load-ext-url-input"), {
      target: { value: "https://example.test/srim.webdedx" },
    });
    await fireEvent.input(screen.getByTestId("load-ext-label-input"), { target: { value: "srim" } });
    await fireEvent.click(screen.getByTestId("load-ext-url-submit"));

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("load-ext-error")).toBeNull();
  });

  it("loads a dropped local directory via File System Access API", async () => {
    class FakeDirectoryHandle {
      readonly kind = "directory";
      constructor(public readonly name: string) {}
    }
    // @ts-expect-error test-only global
    globalThis.FileSystemDirectoryHandle = FakeDirectoryHandle;
    loadFromDirectorySpy.mockResolvedValue({ ...metadataFixture, label: "local", url: "" });

    render(LoadExternalModal, {
      props: {
        open: true,
        existingLabels: new Set<string>(),
        onLoad,
        onCancel,
      },
    });

    await fireEvent.click(screen.getByTestId("load-ext-tab-file"));
    const dropzone = screen.getByTestId("load-ext-dropzone");
    const dirHandle = new FakeDirectoryHandle("local-dataset.webdedx");
    const dataTransfer = {
      items: [{ getAsFileSystemHandle: async () => dirHandle }],
      getData: () => "",
    } as unknown as DataTransfer;

    await fireEvent.drop(dropzone, { dataTransfer });
    await fireEvent.click(screen.getByTestId("load-ext-file-submit"));

    expect(loadFromDirectorySpy).toHaveBeenCalledWith(dirHandle, "local-dataset");
    expect(onLoad).toHaveBeenCalledWith(
      { label: "local-dataset", url: "" },
      expect.objectContaining({ label: "local" }),
    );
  });
});
