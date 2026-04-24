# 2026-04-23 — Dropdown transparency fix + combobox search filter fix

**Model:** (Claude Sonnet 4.6 via Copilot)

## Session Narrative

### Prompt 1: Check the dropdown implementation; fix transparent background and broken search filtering

**AI response**: Explored the entity combobox implementation across three files
(`entity-combobox.svelte`, `entity-selection-comboboxes.svelte`, `src/app.css`)
and diagnosed two independent root causes:

**Bug 1 — Transparent dropdown** (`src/app.css`): The file only contained
`@import 'tailwindcss'`. The `@theme inline` block mapping Tailwind v4 color
utilities (`bg-popover`, `bg-background`, `text-muted-foreground`, etc.) to CSS
custom properties was absent, as were the `:root` and `.dark` variable definitions
supplying actual color values. With no `--popover` / `--background` variables
defined, all `bg-*` classes resolved to `background-color: undefined` (transparent),
making the dropdown panel see-through and causing the "Reset all" button and page
content to bleed through.

**Bug 2 — Filtering does nothing** (`entity-combobox.svelte`): The component used
`bind:inputValue` on `<Combobox.Root>` expecting it to sync typed text back to the
Svelte `inputValue = $state("")` reactive variable, which in turn drives the
`filteredGroups` derived computation. However, bits-ui's `Combobox.Root` declares
`inputValue` as a plain prop (`inputValue = ""`) without `$bindable()`, so the
`bind:` creates only a one-way link (parent → child). When the user types, bits-ui
updates its own internal state and correctly displays the typed text in the controlled
`<input>`, but the write-back setter `(v) => (inputValue = v)` inside bits-ui's
component only mutates the local prop copy — it never reaches the outer component's
`$state`. As a result, `filteredGroups` always computed with `term = ""` and returned
the full unfiltered list.

Fix applied:
- Added `@theme inline` + `:root` / `.dark` CSS variable definitions to `app.css`.
- Removed broken `bind:inputValue` from `<Combobox.Root>`.
- Added `oninput` handler directly on `<Combobox.Input>` to update the Svelte
  reactive state; `mergeProps` in bits-ui ensures both the built-in handler and ours
  fire on every keystroke.
- Reset `inputValue = ""` when `open` becomes `true` so every fresh open starts with
  the full list, regardless of what the user had typed in the previous session.

Created branch `fix/dropdown-transparency-and-search` off `develop`.

### Prompt 2: Add AI logs, update feature spec if needed

**AI response**: Reviewed entity-selection.md (Final v6) — the spec already correctly
describes the desired behavior: "A rounded border, subtle shadow, white background"
and "Typing filters the list in real time (case-insensitive substring match)". Both
bugs were implementation gaps, not spec gaps, so no spec amendment is required.
Created this session log, updated `docs/ai-logs/README.md`, and prepended a row to
`CHANGELOG-AI.md`.

## Tasks

### Fix transparent dropdown background

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `src/app.css`
- **Decision**: Added the full shadcn-style `@theme inline` block (maps `--color-popover` →
  `--popover`, etc.) and `:root` / `.dark` variable definitions. Kept the color
  palette neutral (achromatic OKLCH) matching the shadcn default theme used elsewhere
  in the project.
- **Issue**: none.

### Fix combobox search filtering

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `src/lib/components/entity-combobox.svelte`
- **Decision**: Opted for an `oninput` handler on `<Combobox.Input>` rather than
  patching bits-ui or reimplementing the input from scratch. This is the minimal
  change that respects bits-ui's controlled-input contract while giving the Svelte
  reactive layer the typed value it needs. The `inputValue` reset on `open=true` was
  added to the existing `$effect` that already focuses the search input on open.
- **Issue**: none.
