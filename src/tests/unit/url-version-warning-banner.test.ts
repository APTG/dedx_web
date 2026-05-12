import { test, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import UrlVersionWarningBanner from "$lib/components/url-version-warning-banner.svelte";

beforeEach(() => {
  cleanup();
});

test("renders with version number in text", () => {
  render(UrlVersionWarningBanner, {
    props: { version: 999, onLoadDefaults: vi.fn() },
  });
  expect(screen.getByTestId("url-version-warning")).toBeInTheDocument();
  expect(screen.getByTestId("url-version-warning")).toHaveTextContent("999");
});

test("Load defaults button present and fires callback", async () => {
  const fn = vi.fn();
  const user = userEvent.setup();
  const { getByTestId } = render(UrlVersionWarningBanner, {
    props: { version: 5, onLoadDefaults: fn },
  });
  await user.click(getByTestId("url-version-warning-load-defaults"));
  expect(fn).toHaveBeenCalledOnce();
});

test("Try migration button absent when onTryMigration not provided", () => {
  render(UrlVersionWarningBanner, {
    props: { version: 5, onLoadDefaults: vi.fn() },
  });
  expect(screen.queryByTestId("url-version-warning-try-migration")).not.toBeInTheDocument();
});

test("Try migration button present when onTryMigration provided", () => {
  render(UrlVersionWarningBanner, {
    props: { version: 5, onLoadDefaults: vi.fn(), onTryMigration: vi.fn() },
  });
  expect(screen.getByTestId("url-version-warning-try-migration")).toBeInTheDocument();
});
