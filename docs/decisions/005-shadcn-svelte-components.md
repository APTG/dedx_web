# ADR 005 — UI Component Library: shadcn-svelte + Bits UI

**Status:** Accepted (19 April 2026)

---

## Context

The dEdx Web redesign requires a set of interactive UI components that must
satisfy **WCAG 2.1 Level AA** accessibility (NFR §1) and work correctly within
**Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`). The components
needed across the feature specs are:

| Component need | Feature spec |
|---------------|-------------|
| Typeahead combobox (Particle / Material / Program dropdowns) | [`entity-selection.md`](../04-feature-specs/entity-selection.md) |
| Scrollable list panels with keyboard selection | [`entity-selection.md`](../04-feature-specs/entity-selection.md) |
| Collapsible accordion (Advanced Options) | [`advanced-options.md`](../04-feature-specs/advanced-options.md) |
| Modal dialog / sheet (Custom Compounds builder) | [`custom-compounds.md`](../04-feature-specs/custom-compounds.md) |
| Dropdown menu (Export button with PDF / CSV options) | [`export.md`](../04-feature-specs/export.md) |
| Data table (Results grid, sortable columns) | [`calculator.md`](../04-feature-specs/calculator.md) |
| Toast / notification (URL copied, export done, WASM error) | [`shareable-urls.md`](../04-feature-specs/shareable-urls.md), [`export.md`](../04-feature-specs/export.md) |
| Checkbox, radio group (Advanced Options form controls) | [`advanced-options.md`](../04-feature-specs/advanced-options.md) |

Building each of these from scratch with raw Tailwind + ARIA attributes is a
significant undertaking and a recurring source of subtle accessibility bugs
(focus management, `aria-expanded`, keyboard trapping, screen-reader
announcements).

---

## Decision

Adopt **shadcn-svelte** ([`huntabyte/shadcn-svelte`](https://github.com/huntabyte/shadcn-svelte))
as the UI component library for dEdx Web, backed by **Bits UI**
([`huntabyte/bits-ui`](https://github.com/huntabyte/bits-ui)) as the headless
primitive layer.

Install command (run during Stage 4 SvelteKit scaffold):

```sh
pnpm dlx shadcn-svelte@latest init
```

Add components as needed per feature:

```sh
pnpm dlx shadcn-svelte@latest add combobox accordion dialog table
```

---

## Why shadcn-svelte

### Accessibility by default

Bits UI — the headless primitive layer — implements WAI-ARIA patterns for every
interactive component (focus trapping in dialogs, `aria-expanded` on
comboboxes, keyboard navigation in lists). This directly satisfies NFR §1
(WCAG 2.1 AA) with minimal per-component effort.

### Ownership model fits this project

shadcn-svelte copies component source into `src/lib/components/ui/` — the
project owns the code, can customise it, and is not locked into a runtime
library update cycle. Only Bits UI (the primitive layer) is a runtime
dependency.

### Tailwind CSS is already in the stack

shadcn-svelte is Tailwind-first. No additional styling system is introduced.
Tailwind v4 is fully supported.

### Svelte 5 runes compatible

shadcn-svelte v1.0+ targets Svelte 5 with Bits UI v1.0. Components use Svelte
5 runes internally; there are no `export let` or `$:` patterns.

### AI-agent workflow benefit

shadcn-svelte source is available locally at `vendor/shadcn-svelte/` (git
submodule). AI agents can read component templates directly to generate
correct usage without web access. The `@sveltejs/opencode` MCP (`svelte-autofixer`)
validates Svelte 5 patterns in generated component code.

---

## Alternatives considered

### 1. Raw Tailwind + custom components

Build every combobox, dialog, accordion, etc. from scratch using Tailwind
utility classes.

**Rejected:** Implementing WCAG 2.1 AA correctly for each component (keyboard
navigation, ARIA attributes, focus management) is weeks of work per component
and is a repeated source of bugs. The feature specs already describe the
behaviour in detail — using pre-built accessible primitives is strictly better
for execution speed and correctness.

### 2. Skeleton UI

Svelte-native component library.

**Rejected at evaluation time:** Skeleton UI v3 is in early development.
shadcn-svelte has more components, better Bits UI foundation, and active Svelte 5
migration. Re-evaluate for future projects.

### 3. Flowbite Svelte

Tailwind-based Svelte component library.

**Rejected:** Built on Flowbite's CSS layer, adding a parallel styling system
on top of Tailwind. shadcn-svelte integrates directly with Tailwind without an
extra layer.

### 4. Main `shadcn` CLI (React-based)

The `pnpm dlx shadcn@latest` CLI and its MCP server are **React-only** — no
Svelte support. The correct package is `shadcn-svelte` by Huntabyte. The
`shadcn` MCP server at `ui.shadcn.com/docs/mcp` is therefore **not applicable**
to this project.

---

## Consequences

### Positive

- All comboboxes, dialogs, tables, accordions, and toasts are accessible
  out of the box.
- Consistent visual language across all pages (shadcn default theme + Tailwind
  customisation).
- AI agents have local component source in `vendor/shadcn-svelte/` to reference.
- Reduces feature-spec implementation time for entity selection, advanced options,
  export, and custom compounds.

### Negative / risks

- **Bits UI runtime dependency** — adds a JS dependency to the bundle. Bits UI
  primitives are tree-shaken; only imported components are bundled.
- **Component upgrade path** — since components are copied, new shadcn-svelte
  releases require manual re-copy or `add --overwrite`. This is expected and
  acceptable for a project that owns its component code.
- **Svelte 5 edge cases** — some `$$restProps` patterns in Bits UI may emit
  warnings in strict runes mode. Monitor Bits UI changelog for fixes; workaround
  is to use `{...restProps}` spread at call sites.

---

## Integration plan

| Stage | Action |
|-------|--------|
| Stage 4 (SvelteKit scaffold) | Run `pnpm dlx shadcn-svelte@latest init`; commit base theme |
| Stage 5 (Entity selection) | Add `combobox`, `command`, `popover`, `scroll-area` |
| Stage 6 (Calculator + Plot) | Add `table`, `badge`, `separator` |
| Stage 7 (Advanced options) | Add `accordion`, `checkbox`, `radio-group`, `select`, `slider` |
| Stage 8 (Export + Compounds) | Add `dialog`, `sheet`, `dropdown-menu`, `sonner` (toast) |
| All stages | `button`, `label`, `input`, `tooltip` — add as needed |

---

## References

- [`vendor/shadcn-svelte/`](../../vendor/shadcn-svelte/) — local submodule (component templates + CLI source)
- [`vendor/bits-ui/`](../../vendor/bits-ui/) — local submodule (headless primitive source)
- [shadcn-svelte docs](https://www.shadcn-svelte.com/)
- [Bits UI docs](https://bits-ui.com/docs)
- [`docs/09-non-functional-requirements.md §1`](../09-non-functional-requirements.md) — WCAG 2.1 AA requirement
- [`docs/04-feature-specs/entity-selection.md`](../04-feature-specs/entity-selection.md) — combobox usage
- [`docs/04-feature-specs/advanced-options.md`](../04-feature-specs/advanced-options.md) — accordion usage
