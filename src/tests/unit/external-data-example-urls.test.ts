import { describe, expect, it } from "vitest";
import {
  buildSrimCalculatorExampleUrl,
  buildSrimPlotExampleUrl,
} from "$lib/utils/external-data-example-urls";

function getExternalDataUrl(url: string): string {
  const params = new URL(url).searchParams;
  const extdata = params.get("extdata") ?? "";
  return decodeURIComponent(extdata.slice(extdata.indexOf(":") + 1));
}

describe("external-data user-guide example URLs", () => {
  it("renders absolute same-origin Calculator URL instead of a path-only URL", () => {
    const url = buildSrimCalculatorExampleUrl("http://localhost:5173");

    expect(url).toMatch(/^http:\/\/localhost:5173\/calculator\?/);
    expect(getExternalDataUrl(url)).toMatch(/\/dedxweb\/srim-gui\.webdedx\/$/);
    expect(url).toContain("energies=100");
  });

  it("renders absolute same-origin Plot URL", () => {
    const url = buildSrimPlotExampleUrl("http://localhost:5173/");

    expect(url).toMatch(/^http:\/\/localhost:5173\/plot\?/);
    expect(getExternalDataUrl(url)).toMatch(/\/dedxweb\/srim-gui\.webdedx\/$/);
    expect(url).toContain("program=7");
  });
});
