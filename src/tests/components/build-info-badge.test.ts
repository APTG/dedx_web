import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/svelte";
import BuildInfoBadge from "$lib/components/build-info-badge.svelte";

// Mock $app/paths with empty base for tests
vi.mock("$app/paths", () => ({ base: "" }));

describe("BuildInfoBadge component", () => {
  const mockDeployInfo = {
    date: "2026-05-06",
    commit: "abc1234",
    commitFull: "abc1234def5678901234567890123456789012345678",
    branch: "main",
    repoUrl: "https://github.com/APTG/dedx_web",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("valid deploy.json → renders 'Deployed: abc1234 · 2026-05-06 · main'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDeployInfo,
      }),
    );

    const { container, getByText } = render(BuildInfoBadge);

    // Wait for the effect to complete and render
    await vi.waitFor(
      () => {
        expect(getByText(/Deployed:/)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    expect(container.textContent).toContain("Deployed: abc1234 · 2026-05-06 · main");
  });

  test('valid deploy.json → commit hash is an <a> with correct href and target="_blank"', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDeployInfo,
      }),
    );

    const { getByRole } = render(BuildInfoBadge);

    await vi.waitFor(
      () => {
        const link = getByRole("link", { name: mockDeployInfo.commit });
        expect(link).toHaveAttribute(
          "href",
          `${mockDeployInfo.repoUrl}/commit/${mockDeployInfo.commitFull}`,
        );
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      },
      { timeout: 1000 },
    );
  });

  test("fetch 404 → renders nothing (component root has no text content)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    );

    const { container } = render(BuildInfoBadge);

    await vi.waitFor(
      () => {
        expect(container.textContent).toBe("");
      },
      { timeout: 1000 },
    );
  });

  test("invalid JSON body → renders nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      }),
    );

    const { container } = render(BuildInfoBadge);

    await vi.waitFor(
      () => {
        expect(container.textContent).toBe("");
      },
      { timeout: 1000 },
    );
  });

  test("fetch throws → renders nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const { container } = render(BuildInfoBadge);

    await vi.waitFor(
      () => {
        expect(container.textContent).toBe("");
      },
      { timeout: 1000 },
    );
  });
});
