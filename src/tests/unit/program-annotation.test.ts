import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import ProgramAnnotation from "$lib/components/program-annotation.svelte";

describe("ProgramAnnotation (#816)", () => {
  afterEach(() => cleanup());

  test("renders 'Calculated with <name> (auto-selected)' when auto-selected", () => {
    render(ProgramAnnotation, { props: { programName: "PSTAR", autoSelected: true } });

    const el = screen.getByTestId("program-annotation");
    expect(el.textContent).toContain("Calculated with");
    expect(el.textContent).toContain("PSTAR");
    expect(el.textContent).toContain("(auto-selected)");
  });

  test("omits the '(auto-selected)' qualifier when not auto-selected", () => {
    render(ProgramAnnotation, { props: { programName: "ICRU 49", autoSelected: false } });

    const el = screen.getByTestId("program-annotation");
    expect(el.textContent).toContain("Calculated with");
    expect(el.textContent).toContain("ICRU 49");
    expect(el.textContent).not.toContain("auto-selected");
  });

  test("autoSelected defaults to false", () => {
    render(ProgramAnnotation, { props: { programName: "MSTAR" } });

    expect(screen.getByTestId("program-annotation").textContent).not.toContain("auto-selected");
  });

  test("renders the program name in a bold span", () => {
    const { container } = render(ProgramAnnotation, {
      props: { programName: "PSTAR", autoSelected: true },
    });

    const bold = container.querySelector("span.font-medium");
    expect(bold?.textContent).toBe("PSTAR");
  });

  test("renders nothing when programName is empty", () => {
    render(ProgramAnnotation, { props: { programName: "", autoSelected: true } });

    expect(screen.queryByTestId("program-annotation")).not.toBeInTheDocument();
  });

  test("appends an inline detail after the program when provided", () => {
    render(ProgramAnnotation, {
      props: {
        programName: "ICRU 49",
        autoSelected: true,
        detail: "valid range 0.001 – 10,000 MeV/nucl for proton",
      },
    });

    const el = screen.getByTestId("program-annotation");
    // Single compact line: program, qualifier, and the range detail together.
    expect(el.textContent).toContain("Calculated with");
    expect(el.textContent).toContain("ICRU 49");
    expect(el.textContent).toContain("(auto-selected)");
    expect(el.textContent).toContain("valid range 0.001 – 10,000 MeV/nucl for proton");
  });

  test("omits the detail separator when no detail is given", () => {
    render(ProgramAnnotation, { props: { programName: "PSTAR" } });

    expect(screen.getByTestId("program-annotation").textContent).not.toContain("·");
  });

  test("supports a custom testId (multiple annotations on one page)", () => {
    render(ProgramAnnotation, {
      props: { programName: "PSTAR", autoSelected: true, testId: "plot-program-annotation" },
    });

    expect(screen.getByTestId("plot-program-annotation")).toBeInTheDocument();
    expect(screen.queryByTestId("program-annotation")).not.toBeInTheDocument();
  });
});
