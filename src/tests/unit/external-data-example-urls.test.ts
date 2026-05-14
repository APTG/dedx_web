import { describe, expect, it } from "vitest";
import {
  buildSrimCalculatorExampleUrl,
  buildSrimPlotExampleUrl,
} from "$lib/utils/external-data-example-urls";

describe("external-data user-guide example URLs", () => {
  it("renders absolute same-origin Calculator URL instead of a path-only URL", () => {
    const url = buildSrimCalculatorExampleUrl("http://localhost:5173");

    expect(url).toMatch(/^http:\/\/localhost:5173\/calculator\?/);
    expect(url).toContain(
      "extdata=srim:https%3A%2F%2Fs3.cloud.cyfronet.pl%2Fdedxweb%2Fsrim-gui.webdedx%2F",
    );
    expect(url).toContain("energies=100");
  });

  it("renders absolute same-origin Plot URL", () => {
    const url = buildSrimPlotExampleUrl("http://localhost:5173/");

    expect(url).toMatch(/^http:\/\/localhost:5173\/plot\?/);
    expect(url).toContain(
      "extdata=srim:https%3A%2F%2Fs3.cloud.cyfronet.pl%2Fdedxweb%2Fsrim-gui.webdedx%2F",
    );
    expect(url).toContain("program=7");
  });
});
