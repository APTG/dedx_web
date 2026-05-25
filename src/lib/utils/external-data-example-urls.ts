import { base } from "$app/paths";

const SRIM_EXTDATA_QUERY =
  "urlv=2&extdata=srim:https%3A%2F%2Fs3.cloud.cyfronet.pl%2Fdedxweb%2Fsrim-gui.webdedx%2F";

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

export function buildBasicCalculatorExampleUrl(origin: string): string {
  return `${joinOriginAndBase(origin)}/calculator?urlv=2&particle=1&material=276&program=7&energies=100&eunit=MeV`;
}

export function buildAdvancedCalculatorExampleUrl(origin: string): string {
  return `${joinOriginAndBase(origin)}/calculator?urlv=2&particle=6&material=276&program=7&energies=25,50,100&eunit=MeV&mode=advanced`;
}
