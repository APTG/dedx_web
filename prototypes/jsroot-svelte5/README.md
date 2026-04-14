# JSROOT + Svelte 5 Spike Prototype

A prototype demonstrating JSROOT 7 integration with Svelte 5 `$effect` for reactive,
lifecycle-safe plotting.

## Purpose

This spike validates the plotting architecture for the dEdx Web project.
See [VERDICT.md](./VERDICT.md) for full acceptance criteria results.

## Setup

Install dependencies:

```sh
pnpm install
```

## Developing

Start the development server:

```sh
pnpm dev
```

Open the URL printed by `pnpm dev` (typically `http://localhost:5173`) in your browser.

## Building

Create a production build:

```sh
pnpm build
```

Preview the production build:

```sh
pnpm preview
```

## Recreating this project

To recreate the scaffolding with the same configuration:

```sh
pnpm dlx sv@0.15.1 create --template minimal --types ts --install pnpm /tmp/jsroot-svelte5-temp
```
