---
description: "Draft a feature specification following the project template. Use when writing new feature specs for docs/04-feature-specs/."
agent: "spec-writer"
argument-hint: "Feature name or brief description"
---
Write a feature specification for the dEdx Web project.

## Context
- Read [docs/00-redesign-plan.md](../../docs/00-redesign-plan.md) for full project context.
- The spec MUST follow the template in §7 of that document.
- Reference the [WASM API contract](../../docs/06-wasm-api-contract.md) if it exists.
- Study the old codebase for domain knowledge:
  - [src/Backend/WASMWrapper.js](../../src/Backend/WASMWrapper.js) — libdedx function signatures
  - [src/Backend/Utils.js](../../src/Backend/Utils.js) — unit definitions
  - [src/Components/Pages/Data/Calculator.js](../../src/Components/Pages/Data/Calculator.js) — calculator logic
  - [src/Components/Pages/Plot/Plot.js](../../src/Components/Pages/Plot/Plot.js) — plot logic

## Output Format
Produce a Markdown file with exactly these sections:

```
# Feature: <Name>

## User Story
As a <role>, I want to <action> so that <benefit>.

## Inputs
- (list all user inputs with types and constraints)

## Behavior
- (step-by-step, including edge cases and error handling)

## Output
- (what the user sees or receives)

## Acceptance Criteria
- [ ] (testable criterion — one per checkbox)
```

## Rules
- Be specific about data types, validation rules, and error states.
- Reference `LibdedxService` interface methods when describing data flow.
- Include mobile/responsive considerations.
- Each acceptance criterion must be independently testable.
- Ask the user clarifying questions about physics or UX before writing if anything is ambiguous.
