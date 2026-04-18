# 2026-04-18 — Spike 4: Browser Benchmark + Gate Close

## Session Narrative

### Context

Continuation of Spike 4 (same day as S3 benchmarks). Both gate-blocking items
from VERDICT.md were open: zarrita bundle size and browser CORS. This session
built a Vite browser app, ran the benchmark in a real browser, captured HAR
timing data, and closed both gate items.

---

### Vite App

New Vite + TypeScript app in `browser/` converting the existing Bun-only
`benchmark.ts` into a browser-runnable page. Key additions over the Bun script:

- `globalThis.fetch` interceptor captures **per-request Range headers**, byte
  counts, and `performance.now()` timestamps
- After benchmark, `PerformanceResourceTiming` entries matched to requests
  (used when S3 sends `Timing-Allow-Origin: *`; absent in this case)
- HAR 1.2 JSON export: `startedDateTime`, per-request Range headers, byte
  counts, timing breakdown fields (`-1` where TAO unavailable)
- UI renders: per-request breakdown table, operation summary, cold-start
  budget vs Python S3 baseline, STP verification tables
- `vite.config.ts` with `manualChunks: { zarrita: ["zarrita"] }` to isolate
  zarrita chunk size in build report

Build command: `bun run build`

---

### Bundle Size Result — AC #12

```
dist/assets/zarrita-BbUnr0eD.js    38.62 kB │ gzip: 12.89 kB   ← gate criterion
dist/assets/lz4-BIGKWw27.js        36.59 kB │ gzip: 16.06 kB   ← needed for ZEP2+LZ4
dist/assets/index-CU8daasV.js       9.28 kB │ gzip:  4.02 kB
dist/assets/blosc-E49GQuAK.js     603.44 kB │ gzip: 204.72 kB  ← expected lazy-loaded
dist/assets/zstd-IvP746pw.js      747.49 kB │ gzip: 241.91 kB  ← expected lazy-loaded
```

zarrita core **38.62 kB** — **AC #12 PASS** (≤ 50 kB gate).  
lz4 codec 36.59 kB also needed; total for LZ4 usage = **75.2 kB** minified.  
blosc/zstd appear in build but should lazy-load only when those codecs are
referenced in Zarr metadata. Flagged as post-gate investigation item.

---

### Browser Run — AC #13 (CORS) and AC #9 (browser values)

No CORS errors. All requests succeeded. S3 CORS config working.  
All 16 STP values (H-1/Water + C-12/PMMA) identical between per-ion and
single-shard — AC #9 PASS.

---

### New Finding: zarrita ZEP2 Range Behavior

The browser benchmark's per-request table (with Range header capture) revealed
that zarrita uses Range requests **for per-ion shards too** — not plain GETs
as claimed in earlier VERDICT.md §5.

Per-ion shard access sequence:
1. HEAD probe to `c/0/0/0` (0 bytes — gets `Content-Length` from headers)
2. Range `bytes=140812-140831` (20 bytes — ZEP2 shard index, 1 inner chunk × 16 + 4 CRC)
3. Range `bytes=0-140811` (137.5 KB — data)

Single-shard sequence is identical except step 2 fetches `bytes=40506358-40510953`
(4.5 KB — 287 inner chunks × 16 + 4 CRC).

Previously in Bun, the byte tracker counted all bytes per operation, which
showed 137.5 KB for H-1 (step 3 dominates); the 20-byte index was present but
invisible at KB resolution. The per-request Range capture in the browser app
revealed the full picture.

VERDICT.md §3 (AC #11), §4 (Q11), and §5 rationale updated to reflect this:
- "no Range headers needed" claim removed
- "2 requests per cold start" corrected to 7 (including .zattrs/.zgroup compat probe)
- Per-ion advantage restated as: shard index = 20 bytes vs 4.5 KB

---

### Additional Finding: zarrita v2 Compatibility Probe

Every `open(root(store), { kind: "group" })` call issues two extra requests:
- `GET .zattrs` (0.2 KB, ~54 ms)
- `GET .zgroup` (0.2 KB, ~14 ms)

These are zarrita's legacy Zarr v2 compatibility probes. They add 2 extra
round trips per store open (~70 ms on this connection). Eliminating them
(e.g. by configuring `zarr_format: 3` in the store) is flagged as a
post-gate investigation item.

---

### Cold-Start Results (browser, wifi)

| Format | HTTP requests | Total bytes | Total time |
|--------|---------------|-------------|------------|
| Zarr per-ion | 7 | 225.7 KB | 287 ms |
| Zarr single-shard | 7 | 230.2 KB | 210 ms |

Byte counts match the Python S3 baseline (per-ion 224 KB, single 230 KB).
Timing differences within normal variance on fast wifi.

---

### Files Changed

- `prototypes/extdata-formats/browser/package.json` — updated (vite + typescript devDeps, scripts)
- `prototypes/extdata-formats/browser/vite.config.ts` — new
- `prototypes/extdata-formats/browser/tsconfig.json` — new
- `prototypes/extdata-formats/browser/index.html` — new
- `prototypes/extdata-formats/browser/src/main.ts` — new (Vite benchmark + HAR export)
- `prototypes/extdata-formats/REPORT_BROWSER.md` — new (browser run results)
- `prototypes/extdata-formats/VERDICT.md` — gate closed; §2.5 added; §3/§4/§5 corrected
- `CHANGELOG-AI.md` — new row
- `docs/ai-logs/2026-04-18-spike4-browser-gate.md` — this file
- `docs/ai-logs/README.md` — new entry
