# 2026-05-25 — Issue #589: Fix `pnpm run check` errors

## Session Narrative

### Prompt 1: Fix all svelte-check / tsc type errors (issue #589)

**AI response**: Identified and fixed 47 type errors across 5 files. All errors stem from
`exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true` in the tsconfig. No
behaviour changes — pure type-correctness fixes.

## Tasks

### Fix `src/lib/external-data/units.ts` (lines 126–138)

- **Status**: completed
- **Files changed**: `src/lib/external-data/units.ts`
- **Decision**: `noUncheckedIndexedAccess` makes `array[i]` return `T | undefined`. Changed
  strict `=== null` guards to loose `== null` (covers both null and undefined) so TypeScript
  narrows `prev`, `s0`, and `s1` to non-nullish before arithmetic use.

### Fix `src/tests/components/CsvExportModal.test.ts`

- **Status**: completed
- **Files changed**: `src/tests/components/CsvExportModal.test.ts`
- **Decision**: Added `import type { CsvOptions }` and typed mock variable declarations with
  explicit generic parameters (`vi.fn<(options: CsvOptions, filename: string) => void>()` and
  `vi.fn<() => void>()`) so the `Mock` type matches the component prop signatures.

### Fix `src/lib/components/entity-selection/load-external-modal.svelte`

- **Status**: completed
- **Files changed**: `src/lib/components/entity-selection/load-external-modal.svelte`
- **Decision**: `DataTransferItem.getAsFileSystemHandle` is a non-standard File System Access API
  method not in the bundled TypeScript DOM lib. Introduced a local intersection type
  `DataTransferItemWithFSA` and cast the items array to avoid the "property does not exist" errors
  while preserving the runtime behaviour.

### Fix `src/lib/components/entity-selection/picker-sheet.svelte`

- **Status**: completed
- **Files changed**: `src/lib/components/entity-selection/picker-sheet.svelte`
- **Decision**:
  1. Removed unused `closeButtonEl` state variable and its `bind:this` binding (the close button
     needed no script-side reference).
  2. Extended `programMatches` parameter type from `version?: string` to
     `version?: string | undefined` to satisfy `exactOptionalPropertyTypes`.
  3. Changed `customItems` map to use a conditional spread
     `...(compound.iValue !== undefined ? { iValue: compound.iValue } : {})` so an explicitly-
     undefined `iValue` is never written to an optional property.

### Fix `src/routes/plot/+page.svelte`

- **Status**: completed
- **Files changed**: `src/routes/plot/+page.svelte`
- **Decision**: `invStpBranch: hasInverseStpPair ? "both" : undefined` assigns `undefined`
  explicitly to an `exactOptionalPropertyTypes` field. Replaced with a conditional spread
  `...(hasInverseStpPair ? { invStpBranch: "both" as const } : {})`.
