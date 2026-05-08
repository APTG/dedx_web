#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const docsPath = path.join(repoRoot, "docs/06-wasm-api-contract.md");
const manifestPath = path.join(repoRoot, "wasm/contract-manifest.json");

const docsText = fs.readFileSync(docsPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const requiredSymbols = [
  ...manifest.exports.dedx_tools_flat_inverse,
  ...manifest.exports.dedx_extra_inverse,
];

const missingSymbols = requiredSymbols.filter((symbol) => !docsText.includes(symbol));

const stalePatterns = [
  "Calls: dedx_get_inverse_stp()",
  "Calls: dedx_get_inverse_csda()",
  "| `dedx_get_inverse_stp(ws*, cfg*, stp, side, err*)`",
  "| `dedx_get_inverse_csda(ws*, cfg*, range, err*)`",
];

const staleHits = stalePatterns.filter((pattern) => docsText.includes(pattern));

if (missingSymbols.length === 0 && staleHits.length === 0) {
  console.log("✅ WASM API docs contract check passed");
  process.exit(0);
}

console.error("❌ WASM API docs contract drift detected:");
for (const symbol of missingSymbols) {
  console.error(`  - missing required symbol in docs: ${symbol}`);
}
for (const pattern of staleHits) {
  console.error(`  - stale API wording still present: ${pattern}`);
}
process.exit(1);
