import { FetchStore, open, get, root } from "zarrita";

// ── constants ─────────────────────────────────────────────────────────────────
const BASE        = "https://s3p.cloud.cyfronet.pl/webdedx";
const PER_ION_URL = `${BASE}/srim_synthetic_per_ion.zarr`;
const SINGLE_URL  = `${BASE}/srim_synthetic_single.zarr`;
const PROGRAM     = "srim-2013";
const ION_PROTON  = 0;    // H-1
const ION_CARBON  = 9;    // C-12
const MAT_WATER   = 275;  // WATER (libdedx id 276)
const MAT_PMMA    = 222;  // PMMA  (libdedx id 223)
const E_INDICES   = [0, 10, 30, 50, 80, 100, 130, 164];
const E_LABELS    = ["0.0011", "0.003", "0.025", "0.120", "2.0", "10", "200", "2000"];

// ── request tracking ──────────────────────────────────────────────────────────
interface Req {
  op:    string;
  url:   string;
  range: string | null;
  bytes: number;
  ms:    number;
  t0:    number;     // performance.now() when request started
  perf?: PerformanceResourceTiming;
}

const reqs: Req[] = [];
let _opName  = "";
let _opBytes = 0;
const _origFetch = globalThis.fetch;

function trackOn(name: string) {
  _opName = name; _opBytes = 0;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url
              : input instanceof URL ? input.href : String(input);

    // Capture Range header from whichever form the caller used
    let range: string | null = null;
    const h = init?.headers ?? (input instanceof Request ? input.headers : null);
    if (h instanceof Headers) {
      range = h.get("Range");
    } else if (h && typeof h === "object") {
      range = (h as Record<string, string>)["Range"] ?? (h as Record<string, string>)["range"] ?? null;
    }

    const t0  = performance.now();
    const res = await _origFetch(input, init);
    const buf = await res.clone().arrayBuffer();
    const ms  = performance.now() - t0;
    _opBytes += buf.byteLength;
    reqs.push({ op: _opName, url, range, bytes: buf.byteLength, ms, t0 });
    return res;
  };
}

function trackOff(): number {
  globalThis.fetch = _origFetch;
  return _opBytes;
}

// Match PerformanceResourceTiming entries to our req log after each benchmark run.
// Cleared at the start of each run with performance.clearResourceTimings().
function attachPerfEntries() {
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const used    = new Set<number>();
  for (const req of reqs) {
    if (req.perf) continue;
    // Match in order: first unused entry with the same URL
    const idx = entries.findIndex((e, i) => !used.has(i) && e.name === req.url);
    if (idx >= 0) { req.perf = entries[idx]; used.add(idx); }
  }
}

// ── zarrita module-state (objects survive between timed steps) ────────────────
let piStore!: FetchStore, piStp: ReturnType<typeof open> extends Promise<infer T> ? T : never;
let sStore!:  FetchStore, sStp:  ReturnType<typeof open> extends Promise<infer T> ? T : never;

// ── UI ────────────────────────────────────────────────────────────────────────
const $log = document.getElementById("log")!;
const $res = document.getElementById("results")!;
const $run = document.getElementById("run-btn")    as HTMLButtonElement;
const $exp = document.getElementById("export-btn") as HTMLButtonElement;

function appendLog(s: string) {
  $log.textContent += s + "\n";
  $log.scrollTop = $log.scrollHeight;
}

function kbStr(bytes: number): string {
  return bytes < 1_000_000
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1_000_000).toFixed(2)} MB`;
}

// ── op timing ─────────────────────────────────────────────────────────────────
interface OpRow { label: string; bytes: number; ms: number; note: string; }
const opLog: OpRow[] = [];

async function timedOp(label: string, note: string, fn: () => Promise<void>): Promise<void> {
  trackOn(label);
  const t0 = performance.now();
  let bytes = 0;
  try {
    await fn();
  } finally {
    bytes = trackOff();
  }
  const ms = performance.now() - t0;
  opLog.push({ label, bytes, ms, note });
  appendLog(`  ${kbStr(bytes).padEnd(10)} ${ms.toFixed(0).padStart(5)} ms   ${label}`);
}

// ── benchmarks ────────────────────────────────────────────────────────────────
interface Pair { proton: Float32Array; carbon: Float32Array; }

async function benchPerIon(): Promise<Pair> {
  appendLog("\n── Per-ion Zarr ───────────────────────────────────────────────────────────");
  // eslint-disable-next-line prefer-const
  let proton!: Float32Array, carbon!: Float32Array;

  await timedOp(
    "per-ion / root zarr.json",
    "particles list + materials list + energy grid",
    async () => {
      piStore = new FetchStore(PER_ION_URL);
      await open(root(piStore), { kind: "group" });
    }
  );
  await timedOp(
    "per-ion / stp/zarr.json",
    "array metadata — dtype, shape, ZEP2 sharding codec",
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      piStp = await open(root(piStore).resolve(`${PROGRAM}/stp`), { kind: "array" }) as any;
    }
  );
  await timedOp(
    "per-ion / H-1  HEAD + Range stp/c/0/0/0",
    "zarrita performs a shard probe + Range reads for proton data",
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = await get(piStp as any, [ION_PROTON, MAT_WATER, null]) as { data: Float32Array };
      proton = v.data;
    }
  );
  await timedOp(
    "per-ion / C-12 HEAD + Range stp/c/9/0/0",
    "zarrita performs a shard probe + Range reads for C-12 data",
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = await get(piStp as any, [ION_CARBON, MAT_PMMA, null]) as { data: Float32Array };
      carbon = v.data;
    }
  );

  return { proton, carbon };
}

async function benchSingle(): Promise<Pair> {
  appendLog("\n── Single-shard Zarr ──────────────────────────────────────────────────────");
  // eslint-disable-next-line prefer-const
  let proton!: Float32Array, carbon!: Float32Array;

  await timedOp(
    "single / root zarr.json",
    "particles list + materials list + energy grid",
    async () => {
      sStore = new FetchStore(SINGLE_URL);
      await open(root(sStore), { kind: "group" });
    }
  );
  await timedOp(
    "single / stp/zarr.json",
    "array metadata — dtype, shape, ZEP2 sharding codec",
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sStp = await open(root(sStore).resolve(`${PROGRAM}/stp`), { kind: "array" }) as any;
    }
  );
  await timedOp(
    "single / H-1  Range: shard-index + data chunk",
    "2 Range requests: tail 4.5 KB (shard index) + inner chunk",
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = await get(sStp as any, [ION_PROTON, MAT_WATER, null]) as { data: Float32Array };
      proton = v.data;
    }
  );
  await timedOp(
    "single / C-12  Range: data chunk only (index cached)",
    "shard index already in zarrita memory cache — 1 Range request",
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = await get(sStp as any, [ION_CARBON, MAT_PMMA, null]) as { data: Float32Array };
      carbon = v.data;
    }
  );

  return { proton, carbon };
}

// ── rendering ─────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildTable(heads: string[], rows: string[][]): string {
  const th = heads.map(h => `<th>${h}</th>`).join("");
  const tr = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("\n");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function renderAll(pi: Pair, s: Pair) {
  // ── per-request breakdown ────────────────────────────────────────────────────
  const reqRows = reqs.map(r => {
    const shortUrl = esc(r.url.replace("https://s3p.cloud.cyfronet.pl/webdedx/", "…/webdedx/"));
    const rangeCell = r.range ? `<code>${esc(r.range)}</code>` : "<em style='color:#444'>—</em>";
    // TTFB from PerformanceResourceTiming (only if S3 sends Timing-Allow-Origin)
    let ttfb = "<em style='color:#444'>—</em>";
    if (r.perf && r.perf.requestStart > 0) {
      ttfb = `${(r.perf.responseStart - r.perf.requestStart).toFixed(0)} ms`;
    }
    let transferCell = "<em style='color:#444'>—</em>";
    if (r.perf && r.perf.transferSize > 0) {
      transferCell = kbStr(r.perf.transferSize);
    }
    return [shortUrl, rangeCell, kbStr(r.bytes), `${r.ms.toFixed(0)} ms`, ttfb, transferCell, esc(r.op)];
  });
  const reqTbl = buildTable(
    ["URL (abbreviated)", "Range header", "Body bytes", "Duration", "TTFB*", "Transfer size*", "Operation"],
    reqRows
  );

  // ── op summary ────────────────────────────────────────────────────────────────
  const opRows = opLog.map(o => [
    esc(o.label),
    kbStr(o.bytes),
    `${o.ms.toFixed(0)} ms`,
    esc(o.note),
  ]);
  const opTbl = buildTable(["Operation", "Bytes downloaded", "Duration", "Notes"], opRows);

  // ── cold-start budget ─────────────────────────────────────────────────────────
  // Cold start = zarr.json (root) + stp/zarr.json + first H-1 data fetch
  function coldSubset(prefix: string): OpRow[] {
    return opLog.filter(o =>
      o.label.startsWith(`${prefix} / root`) ||
      o.label.startsWith(`${prefix} / stp`) ||
      o.label.startsWith(`${prefix} / H-1`)
    );
  }
  const piCold = coldSubset("per-ion");
  const sCold  = coldSubset("single");
  const piColdKB = piCold.reduce((a, o) => a + o.bytes, 0);
  const sColdKB  = sCold.reduce((a, o) => a + o.bytes, 0);
  const piColdMS = piCold.reduce((a, o) => a + o.ms, 0);
  const sColdMS  = sCold.reduce((a, o) => a + o.ms, 0);

  const coldTbl = buildTable(
    ["Format", "HTTP requests", "Total bytes", "Total time", "Notes"],
    [
      [
        "Zarr per-ion",
        "5 core (root zarr.json + stp zarr.json + HEAD + 2 Range)",
        kbStr(piColdKB),
        `${piColdMS.toFixed(0)} ms`,
        "Observed in browser; additional v2-compat probes may appear",
      ],
      [
        "Zarr single-shard",
        "4 (root zarr.json + stp zarr.json + shard-index Range + data Range)",
        kbStr(sColdKB),
        `${sColdMS.toFixed(0)} ms`,
        "2 Range requests for first ion",
      ],
    ]
  );

  // ── STP verification tables ───────────────────────────────────────────────────
  function stpRows(a: Float32Array, b: Float32Array): string[][] {
    return E_INDICES.map((idx, k) => {
      const diff  = Math.abs(a[idx] - b[idx]);
      const match = diff < 1e-4;
      const badge = match
        ? `<span class="match-yes">✓</span>`
        : `<span class="match-no">✗ diff=${diff.toExponential(2)}</span>`;
      return [E_LABELS[k], a[idx].toFixed(4), b[idx].toFixed(4), badge];
    });
  }
  const stpH1Tbl = buildTable(
    ["E (MeV/u)", "Per-ion STP (MeV cm²/g)", "Single STP (MeV cm²/g)", "Match"],
    stpRows(pi.proton, s.proton)
  );
  const stpC12Tbl = buildTable(
    ["E (MeV/u)", "Per-ion STP (MeV cm²/g)", "Single STP (MeV cm²/g)", "Match"],
    stpRows(pi.carbon, s.carbon)
  );

  $res.innerHTML = `
    <section>
      <h2>Per-Request Breakdown</h2>
      <p class="note">
        <strong>Range header</strong> captured from our <code>fetch</code> interceptor — shows exactly what zarrita sends.
        <strong>* TTFB and Transfer size</strong> require <code>Timing-Allow-Origin: *</code> from the S3 server (likely not set);
        fields show — if unavailable.<br>
        For full headers, DNS/TLS/TTFB timing breakdown, and status codes:
        <strong>DevTools → Network → right-click any request → Save all as HAR with content</strong>.
      </p>
      ${reqTbl}
    </section>
    <section>
      <h2>Operation Summary</h2>
      ${opTbl}
    </section>
    <section>
      <h2>Cold-Start Budget — first H-1 STP fetch (zarr.json + stp/zarr.json + data)</h2>
      <p class="note">Python S3 benchmark baseline (wifi): per-ion 224 KB / 222 ms &nbsp;·&nbsp; single 230 KB / 324 ms</p>
      ${coldTbl}
    </section>
    <section>
      <h2>STP Verification — H-1 → Water (mat index ${MAT_WATER})</h2>
      ${stpH1Tbl}
    </section>
    <section>
      <h2>STP Verification — C-12 → PMMA (mat index ${MAT_PMMA})</h2>
      ${stpC12Tbl}
    </section>
  `;
}

// ── HAR builder ───────────────────────────────────────────────────────────────
function buildHAR(): object {
  attachPerfEntries();
  const origin = performance.timeOrigin;

  const entries = reqs.map(req => {
    const p    = req.perf;
    const tao  = p != null && p.domainLookupStart > 0;
    const timings: Record<string, number> = {
      blocked: -1, dns: -1, connect: -1, ssl: -1, send: -1, wait: -1, receive: -1,
    };
    if (tao && p) {
      timings.dns     = Math.max(0, p.domainLookupEnd   - p.domainLookupStart);
      timings.connect = Math.max(0, p.connectEnd         - p.connectStart);
      timings.ssl     = p.secureConnectionStart > 0
                          ? Math.max(0, p.connectEnd - p.secureConnectionStart)
                          : 0;
      timings.send    = 0;
      timings.wait    = Math.max(0, p.responseStart - p.requestStart);
      timings.receive = Math.max(0, p.responseEnd   - p.responseStart);
      timings.blocked = -1;
    }

    const reqHeaders: Array<{ name: string; value: string }> = [];
    if (req.range) reqHeaders.push({ name: "Range", value: req.range });

    return {
      startedDateTime: new Date(origin + req.t0).toISOString(),
      time:            req.ms,
      request: {
        method:      "GET",
        url:         req.url,
        httpVersion: "HTTP/1.1",
        headers:     reqHeaders,
        queryString: [],
        headersSize: -1,
        bodySize:    0,
      },
      response: {
        status:      200,
        statusText:  "OK",
        httpVersion: "HTTP/1.1",
        headers:     [],
        content: {
          size:     req.bytes,
          mimeType: "application/octet-stream",
        },
        redirectURL: "",
        headersSize: -1,
        bodySize:    req.bytes,
        // Non-standard: actual transfer size including response headers if TAO present
        _transferSize: p?.transferSize ?? -1,
      },
      cache:    {},
      timings,
      // Non-standard: zarrita operation label
      _zarritaOp: req.op,
    };
  });

  return {
    log: {
      version: "1.2",
      creator: {
        name:    "Spike4-Browser-Benchmark",
        version: "1.0.0",
        comment: "zarrita 0.7.1 zarr v3 benchmark — Spike 4",
      },
      comment:
        "Timing fields (dns/connect/ssl/wait/receive) are -1 unless S3 sends Timing-Allow-Origin: *. " +
        "Range headers captured from fetch interceptor. " +
        "Export from DevTools Network panel for full headers and timing breakdown.",
      entries,
    },
  };
}

// ── main ──────────────────────────────────────────────────────────────────────
let savedHAR: object | null = null;

$run.addEventListener("click", async () => {
  $run.disabled = true;
  $exp.disabled = true;
  $log.textContent = "";
  opLog.length  = 0;
  reqs.length   = 0;
  performance.clearResourceTimings();
  $res.innerHTML = "";

  try {
    appendLog(`Zarr S3 Browser Benchmark   ${new Date().toUTCString()}`);
    appendLog(`Base: ${BASE}`);
    appendLog(`${"─".repeat(75)}`);

    const pi = await benchPerIon();
    const s  = await benchSingle();

    savedHAR = buildHAR();
    renderAll(pi, s);

    appendLog(`\n${"─".repeat(75)}`);
    appendLog("✓ Done — results rendered below.  Use 'Export HAR JSON' button to save timing data.");
    $exp.disabled = false;
  } catch (err) {
    appendLog(`\n✗ ERROR: ${String(err)}`);
    $res.innerHTML = `<p class="error"><strong>Error:</strong> ${esc(String(err))}</p>`;
  } finally {
    $run.disabled = false;
  }
});

$exp.addEventListener("click", () => {
  if (!savedHAR) return;
  const ts   = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const blob = new Blob([JSON.stringify(savedHAR, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `spike4-zarr-${ts}.har.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
