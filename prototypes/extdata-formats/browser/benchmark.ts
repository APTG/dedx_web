/**
 * Zarrita S3 benchmark — Spike 4
 *
 * Fetches STP data for:
 *   - proton (H-1) in Water       ion 0,  mat 275
 *   - carbon-12 (C-12) in PMMA    ion 9,  mat 222
 *
 * Tests both Zarr variants (per-ion and single-shard).
 * Run with:  bun benchmark.ts
 * Writes REPORT_S3_ZARRITA.md in the parent directory.
 */

import { FetchStore, open, get, root } from "zarrita";
import { writeFileSync } from "fs";

const BASE = "https://s3p.cloud.cyfronet.pl/webdedx";
const PER_ION_URL = `${BASE}/srim_synthetic_per_ion.zarr`;
const SINGLE_URL = `${BASE}/srim_synthetic_single.zarr`;
const PROGRAM = "srim-2013";

// Indices from generate_data.py
const ION_PROTON = 0;   // H-1 (Z=1, A=1)
const ION_CARBON = 9;   // C-12 (Z=6, A=12)
const MAT_WATER = 275;  // WATER (libdedx id 276)
const MAT_PMMA = 222;   // PMMA  (libdedx id 223)

// SRIM-2013 energy grid — subset of indices for output
const E_INDICES = [0, 10, 30, 50, 80, 100, 130, 164];  // representative points
// Approximate energies at those indices (MeV/u) based on SRIM grid
const E_LABELS = ["0.0011", "0.003", "0.025", "0.120", "2.0", "10", "200", "2000"];

interface Row {
  label: string;
  sizeKb: number;
  elapsedMs: number;
  note: string;
}

function now(): number {
  return performance.now();
}

function ms(t: number): string {
  return `${t.toFixed(0)} ms`;
}

function sz(bytes: number): string {
  return bytes < 1e6
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1e6).toFixed(2)} MB`;
}

async function fetchSizeBytes(url: string): Promise<number> {
  const r = await fetch(url, { method: "HEAD" });
  return parseInt(r.headers.get("content-length") ?? "0", 10);
}

// Intercept fetch to track bytes downloaded
let _bytesThisOp = 0;

const _origFetch = globalThis.fetch;
function trackingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return _origFetch(input, init).then(async (res) => {
    const clone = res.clone();
    const buf = await clone.arrayBuffer();
    _bytesThisOp += buf.byteLength;
    return res;
  });
}

function startTracking() { _bytesThisOp = 0; globalThis.fetch = trackingFetch; }
function stopTracking(): number { globalThis.fetch = _origFetch; return _bytesThisOp; }


async function timed(
  label: string,
  fn: () => Promise<unknown>,
  note = ""
): Promise<{ elapsedMs: number; sizeKb: number }> {
  startTracking();
  const t0 = now();
  await fn();
  const elapsed = now() - t0;
  const bytes = stopTracking();
  const row: Row = { label, sizeKb: bytes / 1024, elapsedMs: elapsed, note };
  console.log(`  ${label}: ${sz(bytes)} in ${ms(elapsed)}  — ${note}`);
  return { elapsedMs: elapsed, sizeKb: bytes / 1024 };
}

function fmtStp(view: { data: Float32Array; shape: number[] }, label: string): string {
  const n = view.shape[0]; // should be 165 energies
  const lines = [`\n**${label}** — STP (MeV cm²/g) at selected energies`];
  lines.push("| E index | E (MeV/u) | STP |");
  lines.push("|---------|-----------|-----|");
  for (let k = 0; k < E_INDICES.length; k++) {
    const i = E_INDICES[k];
    if (i < n) {
      lines.push(`| ${i} | ${E_LABELS[k]} | ${view.data[i].toFixed(4)} |`);
    }
  }
  return lines.join("\n");
}


async function benchPerIon(): Promise<{ rows: Row[]; stpText: string }> {
  console.log("\n### Zarr per-ion (zarrita)");
  const rows: Row[] = [];
  let stpText = "";

  // Cold: zarr.json
  startTracking();
  let t0 = now();
  const storePI = new FetchStore(PER_ION_URL);
  const grpPI = await open(root(storePI), { kind: "group" });
  let elapsed = now() - t0;
  let bytes = stopTracking();
  console.log(`  zarr.json (root): ${sz(bytes)} in ${ms(elapsed)}`);
  rows.push({ label: "zarr-per-ion / zarr.json (root)", sizeKb: bytes / 1024, elapsedMs: elapsed, note: "particles + materials + energy grid" });

  // Open stp array (fetches srim-2013/stp/zarr.json)
  startTracking();
  t0 = now();
  const stpPI = await open(root(storePI).resolve(`${PROGRAM}/stp`), { kind: "array" });
  elapsed = now() - t0;
  bytes = stopTracking();
  console.log(`  stp/zarr.json: ${sz(bytes)} in ${ms(elapsed)}`);
  rows.push({ label: "zarr-per-ion / stp/zarr.json", sizeKb: bytes / 1024, elapsedMs: elapsed, note: "array metadata" });

  // Proton shard → STP in water
  startTracking();
  t0 = now();
  const protonStp = await get(stpPI, [ION_PROTON, MAT_WATER, null]);
  elapsed = now() - t0;
  bytes = stopTracking();
  console.log(`  H-1 → WATER stp [${protonStp.shape}]: ${sz(bytes)} in ${ms(elapsed)}`);
  rows.push({ label: "zarr-per-ion / H-1 shard → water STP", sizeKb: bytes / 1024, elapsedMs: elapsed, note: "downloads c/0/0/0 (full ion shard)" });
  stpText += fmtStp(protonStp as { data: Float32Array; shape: number[] }, "H-1 in Water (per-ion Zarr)");

  // Carbon shard → STP in PMMA
  startTracking();
  t0 = now();
  const carbonStp = await get(stpPI, [ION_CARBON, MAT_PMMA, null]);
  elapsed = now() - t0;
  bytes = stopTracking();
  console.log(`  C-12 → PMMA stp [${carbonStp.shape}]: ${sz(bytes)} in ${ms(elapsed)}`);
  rows.push({ label: "zarr-per-ion / C-12 shard → PMMA STP", sizeKb: bytes / 1024, elapsedMs: elapsed, note: "downloads c/9/0/0 (full ion shard)" });
  stpText += fmtStp(carbonStp as { data: Float32Array; shape: number[] }, "C-12 in PMMA (per-ion Zarr)");

  return { rows, stpText };
}


async function benchSingle(): Promise<{ rows: Row[]; stpText: string }> {
  console.log("\n### Zarr single shard (zarrita)");
  const rows: Row[] = [];
  let stpText = "";

  // Cold: zarr.json
  startTracking();
  let t0 = now();
  const storeS = new FetchStore(SINGLE_URL);
  await open(root(storeS), { kind: "group" });
  let elapsed = now() - t0;
  let bytes = stopTracking();
  console.log(`  zarr.json (root): ${sz(bytes)} in ${ms(elapsed)}`);
  rows.push({ label: "zarr-single / zarr.json (root)", sizeKb: bytes / 1024, elapsedMs: elapsed, note: "particles + materials + energy grid" });

  // Open stp array
  startTracking();
  t0 = now();
  const stpS = await open(root(storeS).resolve(`${PROGRAM}/stp`), { kind: "array" });
  elapsed = now() - t0;
  bytes = stopTracking();
  console.log(`  stp/zarr.json: ${sz(bytes)} in ${ms(elapsed)}`);
  rows.push({ label: "zarr-single / stp/zarr.json", sizeKb: bytes / 1024, elapsedMs: elapsed, note: "array metadata" });

  // Proton in water — triggers shard-index Range + inner-chunk Range
  startTracking();
  t0 = now();
  const protonStp = await get(stpS, [ION_PROTON, MAT_WATER, null]);
  elapsed = now() - t0;
  bytes = stopTracking();
  console.log(`  H-1 → WATER stp [${protonStp.shape}]: ${sz(bytes)} in ${ms(elapsed)}`);
  rows.push({ label: "zarr-single / H-1 inner chunk → water STP", sizeKb: bytes / 1024, elapsedMs: elapsed, note: "shard-index Range + inner-chunk Range" });
  stpText += fmtStp(protonStp as { data: Float32Array; shape: number[] }, "H-1 in Water (single-shard Zarr)");

  // Carbon in PMMA — shard index already cached, only inner-chunk Range needed
  startTracking();
  t0 = now();
  const carbonStp = await get(stpS, [ION_CARBON, MAT_PMMA, null]);
  elapsed = now() - t0;
  bytes = stopTracking();
  console.log(`  C-12 → PMMA stp [${carbonStp.shape}]: ${sz(bytes)} in ${ms(elapsed)}`);
  rows.push({ label: "zarr-single / C-12 inner chunk → PMMA STP", sizeKb: bytes / 1024, elapsedMs: elapsed, note: "shard-index cached + inner-chunk Range" });
  stpText += fmtStp(carbonStp as { data: Float32Array; shape: number[] }, "C-12 in PMMA (single-shard Zarr)");

  return { rows, stpText };
}


function buildReport(
  piRows: Row[], piStpText: string,
  sRows: Row[], sStpText: string,
  ts: string
): string {
  const tableHeader = "| Request | Size | Latency | Notes |\n|---------|------|---------|-------|";

  const rowMd = (r: Row) =>
    `| ${r.label} | ${(r.sizeKb).toFixed(1)} KB | ${r.elapsedMs.toFixed(0)} ms | ${r.note} |`;

  function coldTotal(rows: Row[], labels: string[]): [number, number] {
    const subset = rows.filter(r => labels.some(l => r.label.includes(l)));
    return [
      subset.reduce((a, r) => a + r.sizeKb, 0),
      subset.reduce((a, r) => a + r.elapsedMs, 0),
    ];
  }

  const [piKb, piMs] = coldTotal(piRows, ["zarr.json (root)", "H-1 shard"]);
  const [sKb, sMs]   = coldTotal(sRows,  ["zarr.json (root)", "H-1 inner chunk"]);

  return [
    `# Spike 4 — S3 Zarrita Benchmark`,
    ``,
    `**Date:** ${ts}  `,
    `**Runtime:** Bun (Node-compatible JS)  `,
    `**Base URL:** \`${BASE}\`  `,
    `**Zarrita version:** 0.7.1`,
    ``,
    `## Per-ion Zarr`,
    ``,
    tableHeader,
    ...piRows.map(rowMd),
    ``,
    `## Single-shard Zarr`,
    ``,
    tableHeader,
    ...sRows.map(rowMd),
    ``,
    `## Cold-start budget — first H-1 STP fetch (zarr.json + data)`,
    ``,
    `| Format | Total KB | Total ms |`,
    `|--------|----------|----------|`,
    `| Zarr per-ion | ${piKb.toFixed(1)} KB | ${piMs.toFixed(0)} ms |`,
    `| Zarr single  | ${sKb.toFixed(1)} KB | ${sMs.toFixed(0)} ms |`,
    ``,
    `## STP values`,
    piStpText,
    sStpText,
    ``,
  ].join("\n");
}


async function main() {
  const ts = new Date().toUTCString();
  console.log(`\nZarrita S3 Benchmark — ${ts}`);
  console.log(`Base: ${BASE}\n`);

  const { rows: piRows, stpText: piStpText } = await benchPerIon();
  const { rows: sRows, stpText: sStpText }   = await benchSingle();

  const report = buildReport(piRows, piStpText, sRows, sStpText, ts);
  const outPath = "../REPORT_S3_ZARRITA.md";
  writeFileSync(outPath, report);
  console.log(`\nWritten: ${outPath}`);
  console.log(report);
}

main().catch(console.error);
