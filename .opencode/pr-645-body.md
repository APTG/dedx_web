## Overview

This PR resolves #645 by implementing live derived UI updates and strict validation gating for the custom compound editor modal.

## Key Changes

- **Live Mass % Updates**: In atoms mode, the editor now dynamically calculates and displays the mass percentage next to each element row.
- **Auto-rescaling in Weight Mode**: Implemented a `<SumTracker>` component that tallies the current weight fractions and provides an auto-rescale feature to seamlessly normalize values to exactly 100%.
- **Formula Footer & Bragg I-Value**: Added the `<FormulaFooter>` component to render the derived chemical formula string and dynamically display the calculated compound _I_-value using the **Bragg additivity rule**.
  - Default elemental _I_-values are sourced from **ICRU Report 37 (1984)** for elements Z=1–92.
- **Strict Validation Gating**: Leveraged Svelte 5 `$derived` state in the `compound-editor-modal.svelte` to robustly gate the "Save" button based on required fields, element validity, and weight fraction sums.
- **Test Suite Modernization**: Updated `custom-compounds.spec.ts` in Playwright to properly assert that the Save button is fully disabled until form conditions are met.

## Testing & Verification

- `element-data.test.ts` updated to test the new ICRU 37 properties.
- Passed all `custom-compounds.spec.ts` Playwright E2E checks with the gated UI behavior.
- Svelte-check strict-mode verified.
