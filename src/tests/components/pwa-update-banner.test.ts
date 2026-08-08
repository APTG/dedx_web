import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import { describe, it, expect, vi, afterEach } from "vitest";
import PwaUpdateBanner from "$lib/components/pwa-update-banner.svelte";

afterEach(() => {
  cleanup();
});

describe("PwaUpdateBanner (#881)", () => {
  it("renders nothing when not visible", () => {
    render(PwaUpdateBanner, { props: { visible: false, onReload: () => {} } });
    expect(screen.queryByTestId("pwa-update-banner")).toBeNull();
  });

  it("shows an update notice in a polite live region when visible", () => {
    render(PwaUpdateBanner, { props: { visible: true, onReload: () => {} } });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/new version of webdedx is available/i);
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("calls onReload when the reload button is clicked", async () => {
    const onReload = vi.fn();
    render(PwaUpdateBanner, { props: { visible: true, onReload } });
    await fireEvent.click(screen.getByTestId("pwa-update-reload-btn"));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
