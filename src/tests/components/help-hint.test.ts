import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import HelpHint from "$lib/components/help-hint.svelte";
import { HELP_TEXT } from "$lib/config/help-text";

describe("HelpHint", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a focusable trigger button", () => {
    render(HelpHint, { props: { text: "Some gloss" } });
    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
    // Native <button> is focusable and not removed from the tab order.
    expect(trigger).not.toHaveAttribute("tabindex", "-1");
  });

  it("derives the accessible name from a registry term", () => {
    render(HelpHint, { props: { term: "program" } });
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAccessibleName(new RegExp(HELP_TEXT.program.text.slice(0, 20)));
  });

  it("lets an inline text override the registry and explicit label override both", () => {
    const { rerender } = render(HelpHint, { props: { text: "Inline gloss here" } });
    expect(screen.getByRole("button")).toHaveAccessibleName(/Inline gloss here/);

    rerender({ text: "Inline gloss here", label: "Custom label" });
    expect(screen.getByRole("button")).toHaveAccessibleName("Custom label");
  });

  it("applies the testId to the trigger", () => {
    render(HelpHint, { props: { text: "x", testId: "my-hint" } });
    expect(screen.getByTestId("my-hint")).toBeInTheDocument();
  });
});
