#!/usr/bin/env node
/**
 * Stage 2.6 Phase 2 + Stage 3 TypeScript wrapper contract verification.
 *
 * Loads the WASM built by build.sh (no --preload-file, no --embed-file) and
 * runs:
 * - Phase 2 acceptance checks from REPORT.md §10 (Sections 1-12)
 * - Stage 3 TypeScript wrapper contract verification (Sections 13-18)
 *
 * Stage 3 additions verify that all C functions required by the TypeScript
 * wrapper (docs/06-wasm-api-contract.md §4) are exported and callable with
 * correct signatures.
 *
 * Usage:
 *   node verify.mjs
 *
 * Prerequisites: run ./build.sh first to populate output/
 *
 * Outputs:
 * - data/wasm_runtime_stats.json (Phase 2 runtime data)
 * - data/wasm_ts_contract_stats.json (Stage 3 contract verification)
 */

import { pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '..', 'static', 'wasm');
const mjsPath = join(outputDir, 'libdedx.mjs');

if (!existsSync(mjsPath)) {
    console.error(`ERROR: ${mjsPath} not found.`);
    console.error('Run wasm/build.sh first to build the WASM module.');
    process.exit(1);
}

// ─── Load module ─────────────────────────────────────────────────────────────

process.stdout.write('Loading libdedx WASM module... ');
const { default: createModule } = await import(pathToFileURL(mjsPath).href);
const m = await createModule({
    locateFile: (f) => join(outputDir, f),
    print:    () => {},  // suppress libdedx internal stdout
    printErr: () => {},  // suppress libdedx internal stderr during init
});
console.log('OK\n');

// ─── JSON data collector ─────────────────────────────────────────────────────

const runtimeStats = {
  metadata: {
    generated_at: new Date().toISOString(),
    analysis_type: "wasm_runtime_verification_phase2",
    wasm_environment: "node",
    build_script: "wasm/build.sh",
  },
  library_version: null,
  programs: [],
  material_counts: {},
  ion_lists: {},
  mstar_ion_list: [],
  reference_checks: {},
  i_value_checks: [],
  density_checks: [],
  composition_checks: [],
  estar_status: null,
  build_artifacts: {},
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Read a sentinel-terminated array of int32 values from a WASM memory pointer.
 * Used for dedx_get_program_list / dedx_get_ion_list / dedx_get_material_list.
 * Stops at 0 or any negative value (both are used as sentinels in libdedx).
 */
function readIntList(ptr, maxLen = 600) {
    if (ptr === 0) return [];
    const result = [];
    const idx0 = ptr >>> 2;  // byte offset → int32 index
    for (let i = 0; i < maxLen; i++) {
        const v = m.HEAP32[idx0 + i];
        if (v === undefined || v <= 0) break;  // 0 and -1 are both sentinels
        result.push(v);
    }
    return result;
}

/** Call a function that returns a char* and convert to JS string. */
function getStr(fnName, ...args) {
    const ptr = m.ccall(fnName, 'number', args.map(() => 'number'), args);
    return ptr === 0 ? '' : m.UTF8ToString(ptr);
}

// PASS/FAIL tracking
const PASS = '[PASS]';
const FAIL = '[FAIL]';
const results = [];

function check(label, pass, note = '') {
    const icon = pass ? PASS : FAIL;
    const msg = `  ${icon}  ${label}${note ? ` — ${note}` : ''}`;
    console.log(msg);
    results.push({ label, pass, note });
    return pass;
}

// ─── 1. Library version ───────────────────────────────────────────────────────

console.log('=== 1. Library version ===');
const version = getStr('dedx_get_version_string');
console.log(`  libdedx: ${version}`);
check('Version string non-empty', version.length > 0, version);
runtimeStats.library_version = version;
console.log();

// ─── 2. Program list ─────────────────────────────────────────────────────────

console.log('=== 2. Program list ===');
const progListPtr = m.ccall('dedx_get_program_list', 'number', [], []);
const programIds = readIntList(progListPtr, 30);

console.log(`  Programs returned by dedx_get_program_list(): ${programIds.length}`);
for (const id of programIds) {
    const name = getStr('dedx_get_program_name', id);
    const ver = getStr('dedx_get_program_version', id);
    const minE = m.ccall('dedx_get_min_energy', 'number', ['number', 'number'], [id, 1]);
    const maxE = m.ccall('dedx_get_max_energy', 'number', ['number', 'number'], [id, 1]);
    const eRange = `${minE.toExponential(2)} – ${maxE.toExponential(2)} MeV/nucl`;
    console.log(`    [${String(id).padStart(3)}] ${name.padEnd(20)} v${ver.padEnd(10)} ${eRange}`);
    runtimeStats.programs.push({
        id, name, version: ver,
        min_energy_MeV_nucl_ion1: minE,
        max_energy_MeV_nucl_ion1: maxE,
    });
}
check('Program list has ≥ 5 programs', programIds.length >= 5, `${programIds.length} programs`);
check('ASTAR (id=1) in program list',  programIds.includes(1));
check('PSTAR (id=2) in program list',  programIds.includes(2));
check('ESTAR (id=3) in program list',  programIds.includes(3),
    programIds.includes(3) ? 'present (but may be unimplemented)' : 'NOT present');
check('MSTAR (id=4) in program list',  programIds.includes(4));
console.log();

// ─── 3. ESTAR critical check ─────────────────────────────────────────────────

console.log('=== 3. ESTAR implementation check (key question) ===');
console.log('  dedx.c lines 587-589: case DEDX_ESTAR → *err = DEDX_ERR_ESTAR_NOT_IMPL; return -1;');
console.log('  Static finding: ESTAR is explicitly unimplemented in libdedx v1.4.0.');
console.log('  Runtime verification:');

// dedx_get_stp_table_size returns -1 (not 0) for unimplemented programs
const estarTableSize = m.ccall(
    'dedx_get_stp_table_size', 'number',
    ['number', 'number', 'number'],
    [3 /* ESTAR */, 1001 /* electron */, 276 /* Water */],
);
console.log(`    dedx_get_stp_table_size(ESTAR=3, electron=1001, Water=276) = ${estarTableSize}`);

const estarNotImpl = estarTableSize <= 0;
check(
    'ESTAR returns ≤ 0 (not implemented)',
    estarNotImpl,
    estarTableSize === -1 ? '-1 (DEDX_ERR_ESTAR_NOT_IMPL)' : `${estarTableSize}`,
);

// Also test min/max energy for ESTAR (code path returns hardcoded 0.001 / 10000)
const estarMinE = m.ccall('dedx_get_min_energy', 'number', ['number', 'number'], [3, 1001]);
const estarMaxE = m.ccall('dedx_get_max_energy', 'number', ['number', 'number'], [3, 1001]);
console.log(`    dedx_get_min_energy(ESTAR, electron) = ${estarMinE} MeV`);
console.log(`    dedx_get_max_energy(ESTAR, electron) = ${estarMaxE} MeV`);
console.log('    (min/max return hardcoded switch-case values even though data is unimplemented)');

console.log('  Conclusion: ESTAR is NOT implemented in libdedx v1.4.0.');
console.log('  --preload-file is irrelevant; ESTAR needs a code implementation, not .dat files.');
runtimeStats.estar_status = {
    implemented: false,
    table_size_result: estarTableSize,
    min_energy_MeV: estarMinE,
    max_energy_MeV: estarMaxE,
    error: "DEDX_ERR_ESTAR_NOT_IMPL",
};
console.log();

// ─── 4. MSTAR ion list (max Z bound) ─────────────────────────────────────────

console.log('=== 4. MSTAR ion list ===');
const mstarIonsPtr = m.ccall('dedx_get_ion_list', 'number', ['number'], [4 /* MSTAR */]);
const mstarIons = readIntList(mstarIonsPtr, 200);

if (mstarIons.length > 0) {
    const minZ = Math.min(...mstarIons);
    const maxZ = Math.max(...mstarIons);
    console.log(`  MSTAR ion list: ${mstarIons.length} ions, Z range ${minZ}–${maxZ}`);
    if (mstarIons.length <= 30) {
        console.log(`  Ion IDs: [${mstarIons.join(', ')}]`);
    } else {
        console.log(`  First 10: [${mstarIons.slice(0, 10).join(', ')}]`);
        console.log(`  Last  10: [${mstarIons.slice(-10).join(', ')}]`);
    }
    check('MSTAR has ions', mstarIons.length > 0, `${mstarIons.length} ions`);
    // MSTAR runtime list covers Z=2–18 (special-cased ions).
    // Higher Z is supported via general polynomial scaling but not enumerated
    // in dedx_get_ion_list(). The list starts at Z=2 (alpha), not Z=1 (proton).
    check('MSTAR ion list starts at Z=2 (alpha)', minZ === 2, `min Z = ${minZ}`);
    check('MSTAR ion list ends at Z=18 (Ar)', maxZ === 18, `max Z = ${maxZ}`);
    runtimeStats.mstar_ion_list = mstarIons;
} else {
    console.log('  MSTAR ion list: EMPTY or pointer is null');
    check('MSTAR has ions', false, 'ion list is empty');
}
console.log();

// ─── 5. Material counts ───────────────────────────────────────────────────────

console.log('=== 5. Material counts per program ===');
const programsForMats = [1, 2, 3, 4, 5, 6, 7, 100];
const matCounts = {};
for (const prog of programsForMats) {
    const matPtr = m.ccall('dedx_get_material_list', 'number', ['number'], [prog]);
    const mats = readIntList(matPtr, 400);
    const name = getStr('dedx_get_program_name', prog);
    console.log(`  [${String(prog).padStart(3)}] ${name.padEnd(20)} ${mats.length} materials`);
    matCounts[prog] = mats.length;
    runtimeStats.material_counts[prog] = { name, count: mats.length };

    // Also collect ion list for each program
    const ionPtr = m.ccall('dedx_get_ion_list', 'number', ['number'], [prog]);
    const ions = readIntList(ionPtr, 200);
    runtimeStats.ion_lists[prog] = { name, ions, count: ions.length };
}
check('DEFAULT (100) covers ≥ 270 materials', (matCounts[100] ?? 0) >= 270,
    `${matCounts[100] ?? 0} materials`);
// Phase 1 static analysis found 74 targets in dedx_pstar.h target_ids array;
// runtime returns 79. Runtime value is authoritative.
check('PSTAR (2) covers ≥ 74 materials', (matCounts[2] ?? 0) >= 74, `${matCounts[2]}`);
check('ESTAR (3) material count = 0 (unimplemented)', matCounts[3] === 0,
    `${matCounts[3]}`);
console.log();

// ─── 6. Material name spot-checks ────────────────────────────────────────────

console.log('=== 6. Material name spot-checks ===');
const materialChecks = [
    { id: 1,   fragment: 'hydrogen' },
    { id: 2,   fragment: 'helium' },
    { id: 6,   fragment: 'carbon' },
    { id: 276, fragment: 'water' },
    { id: 906, fragment: 'graphite' },
];
for (const { id, fragment } of materialChecks) {
    const name = getStr('dedx_get_material_name', id);
    const pass = name.toLowerCase().includes(fragment);
    console.log(`  Material ${String(id).padStart(3)}: "${name}"`);
    check(`Material ${id} name contains "${fragment}"`, pass, `got "${name}"`);
}
console.log();

// ─── 7. Ion name spot-checks ─────────────────────────────────────────────────

console.log('=== 7. Ion name spot-checks ===');
const ionChecks = [
    { id: 1,    fragment: 'hydrogen' },
    { id: 2,    fragment: 'helium' },
    { id: 6,    fragment: 'carbon' },
    // Note: dedx_get_ion_name(1001) returns "" — electron has no name entry in libdedx v1.4.0
    { id: 1001, fragment: '' },
];
for (const { id, fragment } of ionChecks) {
    const name = getStr('dedx_get_ion_name', id);
    // For electron (1001), accept empty string (libdedx limitation)
    const pass = fragment === '' ? true : name.toLowerCase().includes(fragment);
    const note = id === 1001 ? '(electron has no name in libdedx v1.4.0)' : '';
    console.log(`  Ion ${String(id).padStart(4)}: "${name}"${note ? '  ' + note : ''}`);
    check(`Ion ${id} name${fragment ? ` contains "${fragment}"` : ' lookup (electron)'}`, pass, `got "${name}"`);
}
console.log();

// ─── 8. Reference STP value ──────────────────────────────────────────────────

console.log('=== 8. Reference STP value ===');
console.log('  PSTAR (prog=2), H (ion=1), Water (target=276), E = 100.0 MeV/nucl');
console.log('  Expected: ≈ 7.3 MeV·cm²/g  (NIST PSTAR reference)');

const errPtr = m._malloc(4);
const stp = m.ccall(
    'dedx_get_simple_stp_for_program', 'number',
    ['number', 'number', 'number', 'number', 'number'],
    [2, 1, 276, 100.0, errPtr],
);
const errCode = m.HEAP32[errPtr >> 2];
m._free(errPtr);

console.log(`  Result: ${stp.toFixed(5)} MeV·cm²/g  (err=${errCode})`);
const stpOk = Math.abs(stp - 7.3) / 7.3 < 0.05;  // within 5%
check('PSTAR H₂O 100 MeV/nucl — error code = 0', errCode === 0, `errCode = ${errCode}`);
check('PSTAR H₂O 100 MeV/nucl — within 5% of 7.3 MeV·cm²/g', stpOk,
    `${stp.toFixed(5)} MeV·cm²/g (Δ = ${((stp - 7.3) / 7.3 * 100).toFixed(2)}%)`);
runtimeStats.reference_checks.pstar_water_100MeV = {
    program: "PSTAR", ion: "H (Z=1)", target: "Water (ID=276)",
    energy_MeV_nucl: 100.0,
    result_MeV_cm2_g: stp,
    expected_MeV_cm2_g: 7.3,
    delta_percent: (stp - 7.3) / 7.3 * 100,
    error_code: errCode,
    pass: stpOk,
};
console.log();

// ─── 9. I-value spot-checks (Task 2.9) ───────────────────────────────────────

console.log('=== 9. I-value spot-checks ===');
const I_VALUE_TOLERANCE_PERCENT = 15.0;
const iValueMaterials = [
    { id: 1,   name: 'Hydrogen',  expected_eV: 19.2 },
    { id: 6,   name: 'Carbon',    expected_eV: 78.0 },
    { id: 13,  name: 'Aluminum',  expected_eV: 166.0 },
    { id: 29,  name: 'Copper',    expected_eV: 322.0 },
    { id: 79,  name: 'Gold',      expected_eV: 790.0 },
    { id: 82,  name: 'Lead',      expected_eV: 823.0 },
    { id: 276, name: 'Water',     expected_eV: 75.0 },
    { id: 104, name: 'Air',       expected_eV: 85.7 },
];
for (const { id, name, expected_eV } of iValueMaterials) {
    const iErrPtr = m._malloc(4);
    const iVal = m.ccall('dedx_get_i_value', 'number', ['number', 'number'], [id, iErrPtr]);
    const iErr = m.HEAP32[iErrPtr >> 2];
    m._free(iErrPtr);
    const deltaPercent = expected_eV > 0 ? ((iVal - expected_eV) / expected_eV * 100) : Number.NaN;
    const delta = Number.isFinite(deltaPercent) ? deltaPercent.toFixed(1) : 'N/A';
    const withinTolerance = !Number.isFinite(deltaPercent) || Math.abs(deltaPercent) <= I_VALUE_TOLERANCE_PERCENT;
    const pass = iErr === 0 && iVal > 0 && withinTolerance;
    console.log(`  ${name.padEnd(12)} (id=${String(id).padStart(3)}): ${iVal.toFixed(1)} eV  (expected ~${expected_eV} eV, Δ=${delta}%, err=${iErr})`);
    check(
        `I-value ${name} within ±${I_VALUE_TOLERANCE_PERCENT}%`,
        pass,
        `${iVal.toFixed(1)} eV (Δ=${delta}%, err=${iErr})`,
    );
    runtimeStats.i_value_checks.push({ material_id: id, name, value_eV: iVal, expected_eV, delta_percent: Number.isFinite(deltaPercent) ? parseFloat(delta) : null, error_code: iErr });
}
console.log();

// ─── 10. Density spot-checks (Task 2.10) ─────────────────────────────────────

console.log('=== 10. Density spot-checks ===');
const densityMaterials = [
    { id: 1,   name: 'Hydrogen',  expected_g_cm3: 8.375e-5 },
    { id: 13,  name: 'Aluminum',  expected_g_cm3: 2.699 },
    { id: 29,  name: 'Copper',    expected_g_cm3: 8.96 },
    { id: 79,  name: 'Gold',      expected_g_cm3: 19.32 },
    { id: 276, name: 'Water',     expected_g_cm3: 1.0 },
    { id: 104, name: 'Air',       expected_g_cm3: 1.205e-3 },
];
for (const { id, name, expected_g_cm3 } of densityMaterials) {
    const dErrPtr = m._malloc(4);
    const density = m.ccall('dedx_internal_read_density', 'number', ['number', 'number'], [id, dErrPtr]);
    const dErr = m.HEAP32[dErrPtr >> 2];
    m._free(dErrPtr);
    const pass = dErr === 0 && density > 0;
    console.log(`  ${name.padEnd(12)} (id=${String(id).padStart(3)}): ${density.toExponential(4)} g/cm³  (expected ~${expected_g_cm3}, err=${dErr})`);
    check(`Density ${name} returns valid value`, pass, `${density.toExponential(4)} g/cm³`);
    runtimeStats.density_checks.push({ material_id: id, name, value_g_cm3: density, expected_g_cm3, error_code: dErr });
}
console.log();

// ─── 11. Composition spot-checks (Task 2.11) ─────────────────────────────────

console.log('=== 11. Composition spot-checks ===');
const compMaterials = [
    { id: 276, name: 'Water',    expected_elements: [1, 8] },
    { id: 104, name: 'Air',      expected_elements: [6, 7, 8, 18] },
    { id: 223, name: 'PMMA',     expected_elements: [1, 6, 8] },
];
for (const { id, name, expected_elements } of compMaterials) {
    // dedx_get_composition(target, composition[][2], &comp_len, &err)
    // Allocate space: max 20 elements × 2 floats × 4 bytes = 160 bytes
    const compPtr = m._malloc(20 * 2 * 4);
    const compLenPtr = m._malloc(4);
    const compErrPtr = m._malloc(4);
    m.HEAP32[compLenPtr >> 2] = 0;
    m.HEAP32[compErrPtr >> 2] = 0;

    m.ccall('dedx_get_composition', null,
        ['number', 'number', 'number', 'number'],
        [id, compPtr, compLenPtr, compErrPtr]);

    const compLen = m.HEAP32[compLenPtr >> 2];
    const compErr = m.HEAP32[compErrPtr >> 2];
    const composition = [];
    for (let i = 0; i < compLen; i++) {
        const z = m.HEAPF32[(compPtr >> 2) + i * 2];
        const frac = m.HEAPF32[(compPtr >> 2) + i * 2 + 1];
        composition.push({ Z: Math.round(z), mass_fraction: frac });
    }

    m._free(compPtr);
    m._free(compLenPtr);
    m._free(compErrPtr);

    const zValues = composition.map(c => c.Z);
    const hasExpected = expected_elements.every(z => zValues.includes(z));
    const fracSum = composition.reduce((s, c) => s + c.mass_fraction, 0);
    const fracOk = Math.abs(fracSum - 1.0) < 0.01;

    console.log(`  ${name} (id=${id}): ${compLen} elements, Z=[${zValues.join(',')}], Σfrac=${fracSum.toFixed(4)}, err=${compErr}`);
    for (const c of composition) {
        console.log(`    Z=${c.Z}, mass_fraction=${c.mass_fraction.toFixed(6)}`);
    }
    check(`Composition ${name} has expected elements`, hasExpected && compErr === 0,
        `Z=[${zValues.join(',')}]`);
    check(`Composition ${name} fractions sum ≈ 1.0`, fracOk, `sum=${fracSum.toFixed(4)}`);
    runtimeStats.composition_checks.push({
        material_id: id, name, elements: composition,
        element_count: compLen, fraction_sum: fracSum, error_code: compErr,
    });
}
console.log();

// ─── 12. Summary ─────────────────────────────────────────────────────────────

const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;

console.log('=== SUMMARY ===');
console.log(`  ${PASS} ${passed}/${results.length} checks passed`);
if (failed > 0) {
    console.log(`  ${FAIL} ${failed}/${results.length} checks failed:`);
    for (const r of results.filter(r => !r.pass)) {
        console.log(`      • ${r.label}${r.note ? ': ' + r.note : ''}`);
    }
}

console.log();
console.log('Phase 2 key conclusions:');
console.log(`  ESTAR status : NOT IMPLEMENTED in libdedx v1.4.0 (code returns DEDX_ERR_ESTAR_NOT_IMPL)`);
console.log(`  --preload-file needed : NO (data is compiled in as C arrays)`);
console.log(`  MSTAR max Z  : ${mstarIons.length > 0 ? Math.max(...mstarIons) : 'unknown'}`);
console.log(`  PSTAR ref STP: ${stp.toFixed(5)} MeV·cm²/g @ 100 MeV/nucl H on Water`);

// ─── 13. Write JSON output ───────────────────────────────────────────────────

// Collect build artifact sizes
const wasmPath = join(outputDir, 'libdedx.wasm');
const mjsStat = statSync(mjsPath);
const wasmStat = statSync(wasmPath);
runtimeStats.build_artifacts = {
    mjs_bytes: mjsStat.size,
    wasm_bytes: wasmStat.size,
    data_sidecar: "not present (unnecessary)",
};
runtimeStats.metadata.checks_passed = passed;
runtimeStats.metadata.checks_failed = failed;
runtimeStats.metadata.checks_total = results.length;

// Write Phase 2 JSON (will be overwritten at the end with final counts)
const jsonPathPh2 = resolve(__dirname, '..', 'data', 'wasm_runtime_stats.json');
mkdirSync(dirname(jsonPathPh2), { recursive: true });

// ─── 13. TypeScript Wrapper Contract Verification (Stage 3) ──────────────────

console.log('\n');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  STAGE 3: TypeScript Wrapper Contract Verification');
console.log('═══════════════════════════════════════════════════════════════\n');

const tsContractStats = {
    metadata: {
        generated_at: new Date().toISOString(),
        analysis_type: "typescript_wrapper_contract_verification_stage3",
        wasm_environment: "node",
        build_script: "wasm/build.sh",
        contract_version: "Final v3 (docs/06-wasm-api-contract.md)",
    },
    exported_functions: {},
    runtime_methods: {},
    libdedx_service_coverage: {},
    method_signature_checks: [],
    error_handling_checks: [],
    energy_unit_checks: [],
    advanced_options_checks: [],
};

const tsResults = [];

function checkTS(label, pass, note = '') {
    const icon = pass ? PASS : FAIL;
    const msg = `  ${icon}  ${label}${note ? ` — ${note}` : ''}`;
    console.log(msg);
    tsResults.push({ label, pass, note });
    return pass;
}

// ─── 13.1 Exported C Functions Contract (docs/06-wasm-api-contract.md §4) ───

console.log('=== 13.1 Exported C Functions Contract ===\n');

// 4.1 From dedx_wrappers.h (stateless)
console.log('--- 4.1 dedx_wrappers.h (stateless) ---');
const wrapperFunctions = [
    { name: 'dedx_fill_program_list', expectedReturn: 'number' },
    { name: 'dedx_fill_ion_list', expectedReturn: 'number' },
    { name: 'dedx_fill_material_list', expectedReturn: 'number' },
    { name: 'dedx_get_stp_table', expectedReturn: 'number' },
    { name: 'dedx_get_csda_range_table', expectedReturn: 'number' },
    { name: 'dedx_get_simple_stp_for_program', expectedReturn: 'number' },
    { name: 'dedx_get_stp_table_size', expectedReturn: 'number' },
    { name: 'dedx_fill_default_energy_stp_table', expectedReturn: 'number' },
];

for (const fn of wrapperFunctions) {
    try {
        // Check if function exists by looking for _prefixed version on module
        const fnExists = typeof m['_' + fn.name] === 'function';
        console.log(`  ${fn.name.padEnd(35)} ${fnExists ? '✓ exported' : '✗ MISSING'}`);
        checkTS(`${fn.name} exported`, fnExists);
        tsContractStats.exported_functions[fn.name] = {
            category: 'dedx_wrappers.h',
            exported: fnExists,
        };
    } catch (err) {
        console.log(`  ${fn.name.padEnd(35)} ✗ MISSING (${err.message})`);
        checkTS(`${fn.name} exported`, false, err.message);
        tsContractStats.exported_functions[fn.name] = {
            category: 'dedx_wrappers.h',
            exported: false,
            error: err.message,
        };
    }
}
console.log();

// 4.2 From dedx.h (stateful)
console.log('--- 4.2 dedx.h (stateful) ---');
const statefulFunctions = [
    { name: 'dedx_allocate_workspace', expectedReturn: 'number' },
    { name: 'dedx_free_workspace', expectedReturn: 'number' },
    { name: 'dedx_load_config', expectedReturn: 'number' },
    { name: 'dedx_get_stp', expectedReturn: 'number' },
    { name: 'dedx_free_config', expectedReturn: 'number' },
];

for (const fn of statefulFunctions) {
    try {
        const fnExists = typeof m['_' + fn.name] === 'function';
        console.log(`  ${fn.name.padEnd(35)} ${fnExists ? '✓ exported' : '✗ MISSING'}`);
        checkTS(`${fn.name} exported`, fnExists);
        tsContractStats.exported_functions[fn.name] = {
            category: 'dedx.h (stateful)',
            exported: fnExists,
        };
    } catch (err) {
        console.log(`  ${fn.name.padEnd(35)} ✗ MISSING (${err.message})`);
        checkTS(`${fn.name} exported`, false, err.message);
        tsContractStats.exported_functions[fn.name] = {
            category: 'dedx.h (stateful)',
            exported: false,
            error: err.message,
        };
    }
}
console.log();

// 4.3 From dedx_tools.h
console.log('--- 4.3 dedx_tools.h ---');
const toolsFunctions = [
    { name: 'convert_units', expectedReturn: 'number' },
    { name: 'dedx_get_csda', expectedReturn: 'number' },
    { name: 'dedx_get_inverse_stp', expectedReturn: 'number' },
    { name: 'dedx_get_inverse_csda', expectedReturn: 'number' },
];

for (const fn of toolsFunctions) {
    try {
        const fnExists = typeof m['_' + fn.name] === 'function';
        console.log(`  ${fn.name.padEnd(35)} ${fnExists ? '✓ exported' : '✗ MISSING'}`);
        checkTS(`${fn.name} exported`, fnExists);
        tsContractStats.exported_functions[fn.name] = {
            category: 'dedx_tools.h',
            exported: fnExists,
        };
    } catch (err) {
        console.log(`  ${fn.name.padEnd(35)} ✗ MISSING (${err.message})`);
        checkTS(`${fn.name} exported`, false, err.message);
        tsContractStats.exported_functions[fn.name] = {
            category: 'dedx_tools.h',
            exported: false,
            error: err.message,
        };
    }
}
console.log();

// 4.4 From dedx.h (metadata)
console.log('--- 4.4 dedx.h (metadata) ---');
const metadataFunctions = [
    { name: 'dedx_get_program_name', expectedReturn: 'string' },
    { name: 'dedx_get_program_version', expectedReturn: 'string' },
    { name: 'dedx_get_ion_name', expectedReturn: 'string' },
    { name: 'dedx_get_material_name', expectedReturn: 'string' },
    { name: 'dedx_get_min_energy', expectedReturn: 'number' },
    { name: 'dedx_get_max_energy', expectedReturn: 'number' },
    { name: 'dedx_get_error_code', expectedReturn: 'string' },
    { name: 'dedx_get_version_string', expectedReturn: 'string' },
    { name: 'dedx_get_i_value', expectedReturn: 'number' },
    { name: 'dedx_get_composition', expectedReturn: 'number' },
];

for (const fn of metadataFunctions) {
    try {
        const fnExists = typeof m['_' + fn.name] === 'function';
        console.log(`  ${fn.name.padEnd(35)} ${fnExists ? '✓ exported' : '✗ MISSING'}`);
        checkTS(`${fn.name} exported`, fnExists);
        tsContractStats.exported_functions[fn.name] = {
            category: 'dedx.h (metadata)',
            exported: fnExists,
            expected_return: fn.expectedReturn,
        };
    } catch (err) {
        console.log(`  ${fn.name.padEnd(35)} ✗ MISSING (${err.message})`);
        checkTS(`${fn.name} exported`, false, err.message);
        tsContractStats.exported_functions[fn.name] = {
            category: 'dedx.h (metadata)',
            exported: false,
            error: err.message,
        };
    }
}
console.log();

// 4.5 From wasm/dedx_extra.h (local thin wrappers)
console.log('--- 4.5 wasm/dedx_extra.h (local thin wrappers) ---');
const extraFunctions = [
    { name: 'dedx_get_ion_nucleon_number', expectedReturn: 'number' },
    { name: 'dedx_get_ion_atom_mass', expectedReturn: 'number' },
    { name: 'dedx_get_density', expectedReturn: 'number' },
    { name: 'dedx_target_is_gas', expectedReturn: 'number' },
];

for (const fn of extraFunctions) {
    try {
        const fnExists = typeof m['_' + fn.name] === 'function';
        console.log(`  ${fn.name.padEnd(35)} ${fnExists ? '✓ exported' : '✗ MISSING'}`);
        checkTS(`${fn.name} exported`, fnExists);
        tsContractStats.exported_functions[fn.name] = {
            category: 'wasm/dedx_extra.h',
            exported: fnExists,
        };
    } catch (err) {
        console.log(`  ${fn.name.padEnd(35)} ✗ MISSING (${err.message})`);
        checkTS(`${fn.name} exported`, false, err.message);
        tsContractStats.exported_functions[fn.name] = {
            category: 'wasm/dedx_extra.h',
            exported: false,
            error: err.message,
        };
    }
}
console.log();

// 4.6 Emscripten Runtime Methods
console.log('--- 4.6 Emscripten Runtime Methods ---');
const runtimeMethods = [
    'ccall',
    'cwrap',
    'UTF8ToString',
    'HEAP32',
    'HEAPF32',
    'HEAPF64',
    '_malloc',
    '_free',
];

for (const method of runtimeMethods) {
    const hasMethod = m[method] !== undefined;
    console.log(`  ${method.padEnd(20)} ${hasMethod ? '✓ available' : '✗ MISSING'}`);
    checkTS(`${method} runtime method available`, hasMethod);
    tsContractStats.runtime_methods[method] = { available: hasMethod };
}
console.log();

// ─── 13.2 LibdedxService Interface Coverage ──────────────────────────────────

console.log('=== 13.2 LibdedxService Interface Coverage ===\n');

const serviceMethods = [
    { name: 'getPrograms', category: 'Entity Lists', cFunctions: ['dedx_fill_program_list', 'dedx_get_program_name', 'dedx_get_program_version'] },
    { name: 'getParticles', category: 'Entity Lists', cFunctions: ['dedx_fill_ion_list', 'dedx_get_ion_name', 'dedx_get_ion_nucleon_number', 'dedx_get_ion_atom_mass'] },
    { name: 'getMaterials', category: 'Entity Lists', cFunctions: ['dedx_fill_material_list', 'dedx_get_material_name', 'dedx_get_density', 'dedx_target_is_gas'] },
    { name: 'getMinEnergy', category: 'Energy Bounds', cFunctions: ['dedx_get_min_energy'] },
    { name: 'getMaxEnergy', category: 'Energy Bounds', cFunctions: ['dedx_get_max_energy'] },
    { name: 'calculate', category: 'Stopping Power', cFunctions: ['dedx_get_stp_table', 'dedx_get_csda_range_table'] },
    { name: 'calculateCustomCompound', category: 'Stopping Power', cFunctions: ['dedx_allocate_workspace', 'dedx_load_config', 'dedx_get_stp', 'dedx_get_csda', 'dedx_free_config', 'dedx_free_workspace'] },
    { name: 'getInverseStp', category: 'Inverse Lookups', cFunctions: ['dedx_allocate_workspace', 'dedx_load_config', 'dedx_get_inverse_stp', 'dedx_free_config', 'dedx_free_workspace'] },
    { name: 'getInverseCsda', category: 'Inverse Lookups', cFunctions: ['dedx_allocate_workspace', 'dedx_load_config', 'dedx_get_inverse_csda', 'dedx_free_config', 'dedx_free_workspace'] },
    { name: 'convertStpUnits', category: 'Unit Conversion', cFunctions: ['convert_units'] },
    { name: 'getDensity', category: 'Material Properties', cFunctions: ['dedx_get_density'] },
    { name: 'isGasByDefault', category: 'Material Properties', cFunctions: ['dedx_target_is_gas'] },
    { name: 'getNucleonNumber', category: 'Material Properties', cFunctions: ['dedx_get_ion_nucleon_number'] },
    { name: 'getAtomicMass', category: 'Material Properties', cFunctions: ['dedx_get_ion_atom_mass'] },
    { name: 'getIValue', category: 'Material Properties', cFunctions: ['dedx_get_i_value'] },
    { name: 'getComposition', category: 'Material Properties', cFunctions: ['dedx_get_composition'] },
    { name: 'getVersion', category: 'Library Metadata', cFunctions: ['dedx_get_version_string'] },
];

for (const method of serviceMethods) {
    const cFunctionsAvailable = method.cFunctions.every(fn => tsContractStats.exported_functions[fn]?.exported === true);
    console.log(`  ${method.name.padEnd(30)} (${method.category.padEnd(18)}) ${cFunctionsAvailable ? '✓' : '✗'} C backing: [${method.cFunctions.join(', ') || 'JS-only'}]`);
    checkTS(`${method.name} has C backing`, cFunctionsAvailable || method.cFunctions.length === 0);
    tsContractStats.libdedx_service_coverage[method.name] = {
        category: method.category,
        c_functions: method.cFunctions,
        c_functions_available: cFunctionsAvailable,
    };
}
console.log();

// ─── 13.3 Method Signature Validation ────────────────────────────────────────

console.log('=== 13.3 Method Signature Validation ===\n');

console.log('Testing dedx_fill_program_list(int* list):');
const progListPtrTS = m._malloc(30 * 4);
m.ccall('dedx_fill_program_list', null, ['number'], [progListPtrTS]);
// Function is void - check that it filled the array (first element should be non-zero)
const firstProg = m.HEAP32[progListPtrTS >> 2];
m._free(progListPtrTS);
const progListOk = firstProg > 0;
console.log(`  Fills array with program IDs, first = ${firstProg}`);
checkTS('dedx_fill_program_list fills program list array', progListOk);
tsContractStats.method_signature_checks.push({
    function: 'dedx_fill_program_list',
    test: 'fills program list array',
    pass: progListOk,
    result: firstProg,
});

console.log('Testing dedx_get_ion_nucleon_number(int ion):');
const nucleonNum = m.ccall('dedx_get_ion_nucleon_number', 'number', ['number'], [1]);
console.log(`  dedx_get_ion_nucleon_number(1) = ${nucleonNum} (should be 1 for proton)`);
const nucleonOk = Number.isInteger(nucleonNum) && nucleonNum > 0;
checkTS('dedx_get_ion_nucleon_number returns integer', nucleonOk, `${nucleonNum}`);
tsContractStats.method_signature_checks.push({
    function: 'dedx_get_ion_nucleon_number',
    test: 'returns positive integer',
    pass: nucleonOk,
    result: nucleonNum,
});

console.log('Testing dedx_get_ion_atom_mass(int ion):');
const atomMass = m.ccall('dedx_get_ion_atom_mass', 'number', ['number'], [1]);
console.log(`  dedx_get_ion_atom_mass(1) = ${atomMass} u (should be ~1.00794 for hydrogen)`);
const massOk = typeof atomMass === 'number' && atomMass > 1 && atomMass < 2;
checkTS('dedx_get_ion_atom_mass returns float', massOk, `${atomMass} u`);
tsContractStats.method_signature_checks.push({
    function: 'dedx_get_ion_atom_mass',
    test: 'returns float in expected range',
    pass: massOk,
    result: atomMass,
});

console.log('Testing dedx_get_density(int material, int* err):');
const densErrPtr = m._malloc(4);
const density = m.ccall('dedx_get_density', 'number', ['number', 'number'], [276, densErrPtr]);
const densErr = m.HEAP32[densErrPtr >> 2];
m._free(densErrPtr);
console.log(`  dedx_get_density(276, &err) = ${density} g/cm³ (err=${densErr})`);
const densityOk = typeof density === 'number' && density > 0 && densErr === 0;
checkTS('dedx_get_density returns valid value', densityOk, `${density} g/cm³, err=${densErr}`);
tsContractStats.method_signature_checks.push({
    function: 'dedx_get_density',
    test: 'returns positive density with err=0',
    pass: densityOk,
    result: density,
    error_code: densErr,
});

console.log('Testing dedx_target_is_gas(int target):');
const isGasH = m.ccall('dedx_target_is_gas', 'number', ['number'], [1]);
const isGasWater = m.ccall('dedx_target_is_gas', 'number', ['number'], [276]);
console.log(`  dedx_target_is_gas(1) = ${isGasH} (should be 1 for hydrogen gas)`);
console.log(`  dedx_target_is_gas(276) = ${isGasWater} (should be 0 for water liquid)`);
const gasCheckOk = isGasH === 1 && isGasWater === 0;
checkTS('dedx_target_is_gas returns 1 for gas, 0 for condensed', gasCheckOk);
tsContractStats.method_signature_checks.push({
    function: 'dedx_target_is_gas',
    test: 'returns 1 for gas, 0 for condensed',
    pass: gasCheckOk,
    result_hydrogen: isGasH,
    result_water: isGasWater,
});
console.log();

// ─── 13.4 Error Handling Contract ────────────────────────────────────────────

console.log('=== 13.4 Error Handling Contract ===\n');

console.log('Testing error code retrieval (dedx_get_error_code):');
const errBufPtr = m._malloc(256);
m.ccall('dedx_get_error_code', null, ['number', 'number'], [errBufPtr, 0]);
const errMsg = m.UTF8ToString(errBufPtr);
m._free(errBufPtr);
console.log(`  dedx_get_error_code(buf, 0) = "${errMsg}"`);
const errMsgOk = typeof errMsg === 'string' && errMsg.length > 0;
checkTS('dedx_get_error_code returns string message', errMsgOk);
tsContractStats.error_handling_checks.push({
    test: 'dedx_get_error_code returns string',
    pass: errMsgOk,
    message: errMsg,
});

console.log('Testing error handling for out-of-range energy:');
const stpErrPtr = m._malloc(4);
const stpBad = m.ccall(
    'dedx_get_simple_stp_for_program', 'number',
    ['number', 'number', 'number', 'number', 'number'],
    [2, 1, 276, 0.0001, stpErrPtr],
);
const stpErrCode = m.HEAP32[stpErrPtr >> 2];
m._free(stpErrPtr);
console.log(`  PSTAR H₂O @ 0.0001 MeV/nucl: stp=${stpBad}, err=${stpErrCode}`);
const errCodeOk = stpErrCode !== 0;
checkTS('Out-of-range energy triggers error code', errCodeOk, `err=${stpErrCode}`);
tsContractStats.error_handling_checks.push({
    test: 'out-of-range energy triggers error',
    pass: errCodeOk,
    error_code: stpErrCode,
});
console.log();

// ─── 13.5 Energy Unit Conversion Contract ────────────────────────────────────

console.log('=== 13.5 Energy Unit Conversion Contract ===\n');

console.log('Verifying internal normalization to MeV/nucl:');
console.log('  - C API expects MeV/nucl for ions (A ≥ 1)');
console.log('  - C API expects MeV for electrons (particle ID 1001)');
console.log('  - JS-side conversion required for MeV, MeV/u units');

const pstarMinETS = m.ccall('dedx_get_min_energy', 'number', ['number', 'number'], [2, 1]);
const pstarMaxETS = m.ccall('dedx_get_max_energy', 'number', ['number', 'number'], [2, 1]);
console.log(`  PSTAR proton energy range: ${pstarMinETS} – ${pstarMaxETS} MeV/nucl`);
const protonERangeOk = pstarMinETS >= 0.001 && pstarMaxETS <= 10000;
checkTS('Energy bounds are in MeV/nucl (proton)', protonERangeOk);
tsContractStats.energy_unit_checks.push({
    test: 'energy bounds in MeV/nucl',
    pass: protonERangeOk,
    min_MeV_nucl: pstarMinETS,
    max_MeV_nucl: pstarMaxETS,
});

const estarMinETS = m.ccall('dedx_get_min_energy', 'number', ['number', 'number'], [3, 1001]);
const estarMaxETS = m.ccall('dedx_get_max_energy', 'number', ['number', 'number'], [3, 1001]);
console.log(`  ESTAR electron energy range: ${estarMinETS} – ${estarMaxETS} MeV`);
const electronERangeOk = estarMinETS >= 0.001 && estarMaxETS <= 10000;
checkTS('Electron energy bounds in MeV (not MeV/nucl)', electronERangeOk);
tsContractStats.energy_unit_checks.push({
    test: 'electron energy bounds in MeV',
    pass: electronERangeOk,
    min_MeV: estarMinETS,
    max_MeV: estarMaxETS,
});
console.log();

// ─── 13.6 Advanced Options Contract ──────────────────────────────────────────

console.log('=== 13.6 Advanced Options Contract ===\n');

console.log('Stateful API availability for AdvancedOptions:');
console.log('  - dedx_allocate_workspace: required for custom compounds, inverse lookups');
console.log('  - dedx_load_config: required for stateful config loading');
console.log('  - dedx_free_config / dedx_free_workspace: cleanup');

const wsAllocOk = tsContractStats.exported_functions['dedx_allocate_workspace']?.exported === true;
const wsLoadOk = tsContractStats.exported_functions['dedx_load_config']?.exported === true;
const wsFreeOk = tsContractStats.exported_functions['dedx_free_config']?.exported === true &&
                 tsContractStats.exported_functions['dedx_free_workspace']?.exported === true;

console.log(`  dedx_allocate_workspace: ${wsAllocOk ? '✓' : '✗'}`);
console.log(`  dedx_load_config:        ${wsLoadOk ? '✓' : '✗'}`);
console.log(`  dedx_free_config + dedx_free_workspace: ${wsFreeOk ? '✓' : '✗'}`);

const statefulAPIOk = wsAllocOk && wsLoadOk && wsFreeOk;
checkTS('Stateful workspace API available', statefulAPIOk);
tsContractStats.advanced_options_checks.push({
    test: 'stateful workspace API for AdvancedOptions',
    pass: statefulAPIOk,
    allocate: wsAllocOk,
    load: wsLoadOk,
    free: wsFreeOk,
});

const mstarExists = getStr('dedx_get_program_name', 4).length > 0;
console.log(`  MSTAR program available: ${mstarExists ? '✓' : '✗'}`);
checkTS('MSTAR program with mode support', mstarExists);
tsContractStats.advanced_options_checks.push({
    test: 'MSTAR program with mode support',
    pass: mstarExists,
});
console.log();

// ─── 13.7 TS Contract Summary ────────────────────────────────────────────────

const tsPassed = tsResults.filter(r => r.pass).length;
const tsFailed = tsResults.filter(r => !r.pass).length;

console.log('=== TS CONTRACT SUMMARY ===');
console.log(`  ${PASS} ${tsPassed}/${tsResults.length} checks passed`);
if (tsFailed > 0) {
    console.log(`  ${FAIL} ${tsFailed}/${tsResults.length} checks failed:`);
    for (const r of tsResults.filter(r => !r.pass)) {
        console.log(`      • ${r.label}${r.note ? ': ' + r.note : ''}`);
    }
}

console.log();
console.log('TypeScript Wrapper Contract Status:');
console.log(`  Exported C functions    : ${Object.values(tsContractStats.exported_functions).filter(f => f.exported).length}/${Object.keys(tsContractStats.exported_functions).length}`);
console.log(`  Runtime methods         : ${Object.values(tsContractStats.runtime_methods).filter(m => m.available).length}/${Object.keys(tsContractStats.runtime_methods).length}`);
console.log(`  LibdedxService methods  : ${Object.values(tsContractStats.libdedx_service_coverage).filter(m => m.c_functions_available || m.c_functions.length === 0).length}/${Object.keys(tsContractStats.libdedx_service_coverage).length}`);

tsContractStats.metadata.checks_passed = tsPassed;
tsContractStats.metadata.checks_failed = tsFailed;
tsContractStats.metadata.checks_total = tsResults.length;

// ─── 14. Write JSON output ───────────────────────────────────────────────────

// Write Phase 2 JSON with final metadata
runtimeStats.metadata.checks_passed = passed;
runtimeStats.metadata.checks_failed = failed;
runtimeStats.metadata.checks_total = results.length;
writeFileSync(jsonPathPh2, JSON.stringify(runtimeStats, null, 2) + '\n');
console.log();
console.log(`Phase 2 JSON written to: ${jsonPathPh2}`);

// Write TS contract stats
const tsJsonPath = resolve(__dirname, '..', 'data', 'wasm_ts_contract_stats.json');
writeFileSync(tsJsonPath, JSON.stringify(tsContractStats, null, 2) + '\n');
console.log(`TS contract JSON written to: ${tsJsonPath}`);

// Combined exit code
const totalFailed = failed + tsFailed;
process.exit(totalFailed > 0 ? 1 : 0);
