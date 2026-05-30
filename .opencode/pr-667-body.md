## What

Bumps the `libdedx` submodule from `ae1f23d` → `6313d91`, picking up the merged fix [APTG/libdedx#105](https://github.com/APTG/libdedx/pull/105) — *"Fix double-call bug for custom compounds with analytical programs"*.

Also corrects the submodule tracking branch in `.gitmodules` from `master` → `main` (the `master` branch no longer exists upstream).

## Why — fixes #662

In #662, a custom compound (e.g. CR39, `mat_elements=1:18,6:12,8:7`) returned **no values** for **Bethe (100)** and **Bethe ext (101)**, while **PSTAR (2)** worked.

Root cause (fixed upstream in #105): `dedx_internal_validate_config` called `dedx_internal_evaluate_compound` **twice** when `program >= 100` (analytical) **and** `target == 0` (custom compound). The second call failed with `DEDX_ERR_INCONSISTENT_COMPOUND` because mass fractions were already populated, silently breaking the calculation. Tabulated programs like PSTAR (`id < 100`) never hit that path — which is exactly why PSTAR worked in the report.

## Build/deploy note (no committed binaries)

WASM is **not** committed — `static/wasm/libdedx.{mjs,wasm}` are gitignored build artifacts. All workflows check out with `submodules: recursive` and compile fresh via `wasm/build.sh`. So on merge, `deploy.yml` rebuilds WASM from the bumped submodule pointer **automatically**; there is no committed binary to update and no manual rebuild step. Post-deploy, verify with the issue's reproduction URL (Bethe / Bethe ext should now return values for the CR39 compound).

## Tests

Adds an E2E regression test for the #662 scenario: a custom compound calculated with the Bethe analytical program, asserting that stopping-power and CSDA-range values are actually returned (not empty). This guards against the double-call regression at the app level.

Additionally, adds `tests/e2e/pr667-water.spec.ts` to verify that Custom Water (made from elements H:2, O:1) produces similar CSDA ranges as Predefined Liquid Water (ID 276) across multiple energies. The same test file also adds regression coverage for advanced combined table stability, explicitly verifying that dynamically adding and removing energy rows via keyboard interactions is handled robustly.

## Submodule change

```
Submodule libdedx ae1f23d..6313d91:
  > Fix double-call bug for custom compounds with analytical programs (#105)
  > ... (intermediate dependency/doc bumps)
```

https://claude.ai/code/session_01Li8whPdRMx4ZT6Z1Khv5wD
