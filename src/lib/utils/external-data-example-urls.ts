import { base } from "$app/paths";

const SRIM_EXTDATA_QUERY =
  "urlv=1&extdata=srim:https%3A%2F%2Fexample.com%2Fwebdedx%2Fsrim-demo.webdedx%2F";

function joinOriginAndBase(origin: string): string {
  const cleanOrigin = origin.replace(/\/$/, "");
  return `${cleanOrigin}${base}`;
}

export function buildSrimCalculatorExampleUrl(origin: string): string {
  return `${joinOriginAndBase(origin)}/calculator?${SRIM_EXTDATA_QUERY}&particle=1&material=276&program=7&energies=100&eunit=MeV`;
}

export function buildSrimPlotExampleUrl(origin: string): string {
  return `${joinOriginAndBase(origin)}/plot?${SRIM_EXTDATA_QUERY}&particle=1&material=276&program=7`;
}
