# 2026-07-03 — Basic single-energy hero row (#823)

## Session Narrative

### Prompt 1: Work on issue #823, make PR when ready

**Request.** Issue #823 ("Input energy") is a UI-polish brief with two scoped
goals:

- **§4a** — give the Basic-mode single-energy input more visual weight and tie
  it to its results. Today the single-row layout (`isSingleRow` branch of
  `results/table-basic.svelte`) stacks a small `w-24` input above a separate
  `grid grid-cols-2` results card, so the input is underweight and disconnected
  from the numbers it produces. Goal: on desktop, present the kinetic-energy
  input **on the same row as its two outputs** — energy → range → dE/dx — as
  three framed cells reading left-to-right as _input → results_, with the energy
  cell the orange hero and the unit pill kept **tight against the number**.
  Mobile stacks into a centered energy input on top and two result cells below.
- **§4b** — explore lightweight particle/material/energy flow color-coding
  **options** (§6), explicitly _not_ unilaterally picking one, and _not_
  redesigning the pickers (hard constraint §5).

**AI response.** Read the issue and the real files it named (`table-basic.svelte`,
`calculator/+page.svelte`, `program-annotation.svelte`, `picker-summary-bar.svelte`,
`app.css`, `calculator.md`) plus the e2e specs that assert the Basic single-row
test ids, to avoid breaking selectors.

Tried to ask the maintainer which §4b direction to take via `AskUserQuestion`,
but the tool call failed (permission stream closed) and the GitHub MCP briefly
disconnected. Rather than block, proceeded with the issue's own recommendation
and the app's established identity: **option 4 (energy-only, minimal)** — build
the §4a hero row and leave the pickers untouched, keeping orange as the single
accent. This is the smallest, most reviewable PR and directly serves #665's
intent; the multi-hue options (§6 numbered-steps / two-tone) are called out as a
deferred, separate decision in the PR/changelog.

Implemented the hero row in the `isSingleRow` branch:

- **① Kinetic energy (hero)** — orange-accented cell (`border-orange-300 /
  bg-orange-50`, dark variants `border-orange-700/60 / bg-orange-950/40`), an
  eyebrow "Kinetic energy" label bound to the input (`for`), the value in a
  transparent borderless `font-mono` input (`text-2xl sm:text-3xl`,
  **right-aligned**) with the master-unit pill (`bg-orange-200 …`) placed
  immediately after it so value+unit read tight regardless of magnitude.
  Invalid / out-of-range flips border/label/message to the `destructive` red
  treatment. The first-focus inline-unit hint and the proton↔heavy-ion "unit
  changed" ghost note are preserved unchanged.
- **② CSDA range / ③ stopping power** — neutral `bg-muted/20` result cells,
  each with its quantity label + existing `HelpHint` above a large `font-mono`
  value (`text-xl sm:text-2xl`, one step below the energy for hierarchy). A
  subtle `→` connector sits between input and results on desktop only.
- **Layout** — outer `flex flex-col gap-3 sm:flex-row sm:items-stretch`; the two
  result cells live in a `grid grid-cols-2 gap-3 sm:contents` wrapper so on
  mobile they form the second row side-by-side and on desktop the wrapper
  disappears (`display:contents`) and both cells become flex siblings
  (`sm:flex-1`) of the energy cell (`sm:flex-[1.4]`) and connector.

**Verification.** No built WASM locally (the live calculator can't reach the
`isComplete` state that renders the card), so verified the layout faithfully by
adding a throwaway route rendering the real markup with static values, served by
the dev server (real Tailwind + real `app.css` tokens), and screenshotting with
the preinstalled Chromium at desktop (1000px) and mobile (390px) in both light
and dark and in valid + error states. All four combinations matched the spec;
the throwaway route + scripts were deleted before commit. `pnpm run check`
(`svelte-check` + `tsc`) reported 0 errors / 0 warnings; ESLint and Prettier
clean.

## Tasks

### Basic single-energy hero row

- **Status**: completed
- **Stage**: Stage 8 polish (calculator), issue #823 §4a
- **Files changed**:
  - `src/lib/components/results/table-basic.svelte` (the `isSingleRow` branch)
  - `docs/04-feature-specs/calculator.md` (new "Basic single-energy hero row" subsection)
  - `CHANGELOG-AI.md`, `docs/ai-logs/2026-07-03-issue-823-basic-hero-row.md`, `docs/ai-logs/README.md`
- **Decision**: Chose issue **option 4 (energy-only emphasis)** for §4b because the
  `AskUserQuestion` prompt failed and the pickers are explicitly out of scope for
  redesign; orange stays the single accent. The unit "tight against the number"
  requirement is met by right-aligning the input and placing the unit pill
  adjacent, so short and long values both hug the pill. Result values are one
  type-step below the energy value to keep energy the hero, especially on mobile.
- **Issue**: §4b flow color-coding (§6 options 2–3, numbered steps / two-tone)
  intentionally **not** implemented — deferred for a maintainer decision, since the
  issue says to present options rather than pick one and the `AskUserQuestion`
  call could not be delivered this session.
