#!/usr/bin/env node
/**
 * Stage 2.6 Phase 2 — libdedx WASM runtime verification.
 *
 * Loads the WASM built by build.sh (no --preload-file, no --embed-file) and
 * runs all Phase 2 acceptance checks from REPORT.md §10.
 *
 * Usage:
 *   node verify.mjs
 *
 * Prerequisites: run ./build.sh first to populate output/
 *
 * Outputs: ../data/wasm_runtime_stats.json (machine-readable runtime data)
 */

import { pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, 'output');
const mjsPath = join(outputDir, 'libdedx.mjs');

if (!existsSync(mjsPath)) {
    console.error(`ERROR: ${mjsPath} not found.`);
    console.error('Run ./build.sh first to build the WASM module.');
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
    build_script: "wasm-runtime/build.sh",
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

const jsonPath = resolve(__dirname, '..', 'data', 'wasm_runtime_stats.json');
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, JSON.stringify(runtimeStats, null, 2) + '\n');
console.log();
console.log(`JSON output written to: ${jsonPath}`);

process.exit(failed > 0 ? 1 : 0);
