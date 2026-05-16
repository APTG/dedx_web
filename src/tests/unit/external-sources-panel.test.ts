import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ExternalSourcesPanel from "$lib/components/entity-selection/external-sources-panel.svelte";
import { externalDataService } from "$lib/external-data/service";
import type { ExternalSourceDescriptor } from "$lib/external-data/types";
import type { ExternalStoreMetadata } from "$lib/external-data/schema";

function meta(
  label: string,
  overrides: Partial<ExternalStoreMetadata> = {},
): ExternalStoreMetadata {
  return {
    label,
    url: `https://example.test/${label}.webdedx/`,
    name: `${label.toUpperCase()} dataset`,
    version: "1.0",
    author: "Test Author",
    license: "CC-BY-4.0",
    description: "A short fixture description for unit tests.",
    programs: [{ id: `${label}-prog`, name: `${label} program` }],
    particles: [
      { id: "p", name: "Proton", symbol: "p", Z: 1, A: 1, atomicMass: 1, pdgCode: 2212, index: 0 },
    ],
    materials: [
      { id: "water", name: "Water", icruId: 276, density: 1, index: 0, linearUnitsAvailable: true },
    ],
    energyGrid: [1, 10, 100],
    energyUnit: "MeV",
    stpUnit: "MeV·cm²/g",
    hasCsdaRange: false,
    ...overrides,
  };
}

describe("ExternalSourcesPanel", () => {
  beforeEach(() => {
    vi.spyOn(externalDataService, "getMetadata").mockImplementation((label: string) =>
      label === "srim" ? meta("srim") : undefined,
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    cleanup();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("renders nothing when no sources are loaded", () => {
    const { container } = render(ExternalSourcesPanel, { props: { sources: [] } });
    expect(container.querySelector('[data-testid="external-sources-panel"]')).toBeNull();
  });

  it("is collapsed by default and shows the source count", () => {
    const sources: ExternalSourceDescriptor[] = [
      { label: "srim", url: "https://example.test/srim.webdedx/" },
    ];
    render(ExternalSourcesPanel, { props: { sources } });

    const summary = screen.getByTestId("external-sources-summary");
    expect(summary).toHaveTextContent(/External Data Sources/i);
    expect(summary).toHaveTextContent(/\(1\)/);

    // Collapsed: details element open attribute is false
    const details = summary.closest("details")!;
    expect(details.open).toBe(false);
  });

  it("expands to reveal metadata, coverage and a clickable source URL", async () => {
    const user = userEvent.setup();
    const sources: ExternalSourceDescriptor[] = [
      { label: "srim", url: "https://example.test/srim.webdedx/" },
    ];
    render(ExternalSourcesPanel, { props: { sources } });

    await user.click(screen.getByTestId("external-sources-summary"));

    expect(screen.getByText(/SRIM dataset/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.0/)).toBeInTheDocument();
    expect(screen.getByText(/Test Author/)).toBeInTheDocument();
    expect(screen.getByText(/CC-BY-4\.0/)).toBeInTheDocument();
    expect(screen.getByText(/1 programs, 1 particles, 1 materials/)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /srim\.webdedx/ });
    expect(link).toHaveAttribute("href", "https://example.test/srim.webdedx/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("truncates a long description to 200 characters with an ellipsis", async () => {
    const longDesc = "a".repeat(300);
    vi.spyOn(externalDataService, "getMetadata").mockReturnValue(
      meta("srim", { description: longDesc }),
    );
    const user = userEvent.setup();
    render(ExternalSourcesPanel, {
      props: { sources: [{ label: "srim", url: "https://example.test/srim.webdedx/" }] },
    });
    await user.click(screen.getByTestId("external-sources-summary"));

    const dd = screen.getByText(/^a+…$/);
    // 200 'a's + ellipsis "…"
    expect(dd.textContent?.length).toBe(201);
  });

  it("renders a Remove button for each source and calls onRemove with the label", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const sources: ExternalSourceDescriptor[] = [
      { label: "srim", url: "https://example.test/srim.webdedx/" },
    ];
    render(ExternalSourcesPanel, { props: { sources, onRemove } });

    const removeBtn = screen.getByTestId("external-source-remove-srim");
    expect(removeBtn).toBeInTheDocument();

    await user.click(removeBtn);

    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledWith("srim");
  });

  it("evicts the source from ExternalDataService when Remove is clicked", async () => {
    const user = userEvent.setup();
    const evictSpy = vi.spyOn(externalDataService, "evict");
    const sources: ExternalSourceDescriptor[] = [
      { label: "srim", url: "https://example.test/srim.webdedx/" },
    ];
    render(ExternalSourcesPanel, { props: { sources } });

    await user.click(screen.getByTestId("external-source-remove-srim"));

    expect(evictSpy).toHaveBeenCalledWith("srim");
  });

  it("renders per-source collapsible rows that expand to show metadata", async () => {
    const user = userEvent.setup();
    const sources: ExternalSourceDescriptor[] = [
      { label: "srim", url: "https://example.test/srim.webdedx/" },
    ];
    render(ExternalSourcesPanel, { props: { sources } });

    // Expand the outer disclosure first
    await user.click(screen.getByTestId("external-sources-summary"));

    // Per-source row should be collapsed by default
    const srcSummary = screen.getByTestId("external-source-summary-srim");
    const srcDetails = srcSummary.closest("details")!;
    expect(srcDetails.open).toBe(false);

    // Expand the per-source row
    await user.click(srcSummary);
    expect(srcDetails.open).toBe(true);

    // Metadata should now be visible
    expect(screen.getByText(/Test Author/)).toBeInTheDocument();
  });
});
