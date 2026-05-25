// CommonJS — intentionally NOT a module so it works with plain `node`.
const { execSync } = require("child_process");
const { writeFileSync, mkdirSync } = require("fs");
const { resolve } = require("path");

const REFS_HEADS_PREFIX = "refs/heads/";
const HEADS_PREFIX = "heads/";

function stripHeadsPrefix(ref) {
  if (ref.startsWith(REFS_HEADS_PREFIX)) return ref.slice(REFS_HEADS_PREFIX.length);
  return ref.startsWith(HEADS_PREFIX) ? ref.slice(HEADS_PREFIX.length) : ref;
}
exports.stripHeadsPrefix = stripHeadsPrefix;

function main() {
  const run = (cmd) => {
    try {
      return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return "";
    }
  };

  const gitCommitFull = run("git rev-parse HEAD");
  const gitCommit = run("git rev-parse --short HEAD");
  const gitRef = run("git describe --all");
  if (!gitCommitFull || !gitCommit || !gitRef) {
    console.warn("deploy.cjs: git metadata unavailable, using fallback build info");
  }

  const commitFull = gitCommitFull || process.env.GITHUB_SHA || "unknown";
  const fallbackShortCommit = /^[0-9a-f]{40}$/i.test(commitFull) ? commitFull.slice(0, 7) : "unknown";
  const commit = gitCommit || fallbackShortCommit;
  const rawRef = gitRef || process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || "unknown";
  const branch = stripHeadsPrefix(rawRef);
  const date = new Date().toISOString().slice(0, 10);

  const info = {
    date,
    commit,
    commitFull,
    branch,
    repoUrl: "https://github.com/APTG/dedx_web",
  };

  const outDir = resolve(__dirname, "..", "static");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "deploy.json"), JSON.stringify(info, null, 2));
  console.log(`deploy.json written: ${commit} · ${date} · ${branch}`);
}

if (require.main === module) {
  main();
}
