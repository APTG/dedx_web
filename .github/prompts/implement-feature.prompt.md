---
description: "Implement a feature from a spec file in docs/04-feature-specs/. Use when building a new feature for the dEdx Web app."
agent: "agent"
argument-hint: "Path to feature spec, e.g. docs/04-feature-specs/calculator.md"
---
Implement a feature for the dEdx Web project from a specification file.

## Before Writing Code
1. Read the feature spec file provided as the argument.
2. Read [docs/03-architecture.md](../../docs/03-architecture.md) for component structure.
3. Read [docs/06-wasm-api-contract.md](../../docs/06-wasm-api-contract.md) for the `LibdedxService` interface.
4. Check `docs/progress/` for what has already been completed.

## Implementation Rules
- **Svelte 5 only**: Use `$state`, `$derived`, `$effect`, `$props`. Never use `export let`, `$:`, `createEventDispatcher()`, or `onMount`/`onDestroy`.
- **TypeScript strict**: All code must be typed. No `any` except at WASM boundaries with explicit casts.
- **Tailwind CSS**: No custom CSS files unless absolutely necessary.
- **Component location**: Reusable components in `src/lib/components/`, page-specific in `src/routes/`.
- **WASM calls**: Always go through the `LibdedxService` interface, never call Emscripten directly.

## Testing Requirements
- Write Vitest unit tests for all business logic.
- Write Svelte component tests for interactive behavior.
- Mock `LibdedxService` in tests — never depend on real WASM in unit tests.
- Every acceptance criterion from the spec must have a corresponding test.

## After Implementation
- Run `npm run lint && npm run format` to verify code style.
- Run `npm run test` to verify all tests pass.
- List which acceptance criteria from the spec are now covered.
- Suggest a conventional commit message: `feat: <description>`.
