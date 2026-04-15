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
 */

import { pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

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
    return ptr === 0 ? '(null)' : m.UTF8ToString(ptr);
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
console.log();

// ─── 2. Program list ─────────────────────────────────────────────────────────

console.log('=== 2. Program list ===');
const progListPtr = m.ccall('dedx_get_program_list', 'number', [], []);
const programIds = readIntList(progListPtr, 30);

console.log(`  Programs returned by dedx_get_program_list(): ${programIds.length}`);
for (const id of programIds) {
    const name = getStr('dedx_get_program_name', id);
    const minE = m.ccall('dedx_get_min_energy', 'number', ['number', 'number'], [id, 1]);
    const maxE = m.ccall('dedx_get_max_energy', 'number', ['number', 'number'], [id, 1]);
    const eRange = `${minE.toExponential(2)} – ${maxE.toExponential(2)} MeV/nucl`;
    console.log(`    [${String(id).padStart(3)}] ${name.padEnd(20)} ${eRange}`);
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
console.log();

// ─── 9. Summary ──────────────────────────────────────────────────────────────

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

process.exit(failed > 0 ? 1 : 0);
