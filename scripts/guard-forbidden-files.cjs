#!/usr/bin/env node

const { execSync } = require("node:child_process");

const FORBIDDEN_PATH_PATTERNS = [
  /^static\/wasm\//,
  /^static\/deploy\.json$/,
  /^playwright-report\//,
  /^test-results\//,
  /^\.playwright-mcp\//,
];

function run(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function parseRawDiff(rawText) {
  const gitlinks = [];
  for (const line of rawText.split("\n")) {
    if (!line.startsWith(":")) continue;
    const tabIdx = line.indexOf("\t");
    if (tabIdx === -1) continue;
    const meta = line.slice(1, tabIdx).trim().split(/\s+/);
    if (meta.length < 2) continue;
    const [oldMode, newMode] = meta;
    const path = line.slice(tabIdx + 1).trim();
    const isGitlink = oldMode === "160000" || newMode === "160000";
    if (isGitlink && path.startsWith("vendor/")) {
      gitlinks.push(path);
    }
  }
  return gitlinks;
}

function matchesForbiddenPattern(path) {
  return FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function listChangedFiles(mode, range) {
  if (mode === "staged") {
    const changed = run("git diff --cached --name-only --diff-filter=ACMRDTUXB");
    const raw = run("git diff --cached --raw --no-abbrev");
    return {
      paths: changed ? changed.split("\n").filter(Boolean) : [],
      vendorGitlinks: parseRawDiff(raw),
    };
  }

  const changed = run(`git diff --name-only --diff-filter=ACMRDTUXB ${range}`);
  const raw = run(`git diff --raw --no-abbrev ${range}`);
  return {
    paths: changed ? changed.split("\n").filter(Boolean) : [],
    vendorGitlinks: parseRawDiff(raw),
  };
}

function parseMode() {
  if (process.argv.includes("--staged")) {
    return { mode: "staged", range: undefined };
  }
  const range = getArgValue("--range");
  if (range) {
    return { mode: "range", range };
  }

  console.error(
    "Usage: node scripts/guard-forbidden-files.cjs --staged OR --range <base..head>",
  );
  process.exit(2);
}

function main() {
  const { mode, range } = parseMode();
  const { paths, vendorGitlinks } = listChangedFiles(mode, range);

  const pathViolations = paths.filter(matchesForbiddenPattern);
  const allViolations = [];

  for (const path of pathViolations) {
    allViolations.push(`forbidden generated/artifact path: ${path}`);
  }
  for (const path of vendorGitlinks) {
    allViolations.push(`forbidden vendor gitlink change: ${path}`);
  }

  if (allViolations.length > 0) {
    console.error("❌ Guard check failed:");
    for (const violation of allViolations) {
      console.error(`  - ${violation}`);
    }
    console.error(
      "\nIf this is intentional (e.g., dedicated dependency/submodule maintenance), use a separate scoped PR.",
    );
    process.exit(1);
  }

  console.log(
    `✅ Guard check passed (${mode === "staged" ? "staged diff" : `range ${range}`}; ${paths.length} changed path(s))`,
  );
}

main();
