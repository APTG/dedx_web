// CommonJS — intentionally NOT a module so it works with plain `node`.
const { execSync } = require("child_process");
const { writeFileSync, mkdirSync } = require("fs");
const { resolve } = require("path");

function stripHeadsPrefix(ref) {
  if (ref.startsWith("refs/heads/")) return ref.slice("refs/heads/".length);
  return ref.startsWith("heads/") ? ref.slice("heads/".length) : ref;
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

  const commitFull = run("git rev-parse HEAD") || process.env.GITHUB_SHA || "unknown";
  const commit = run("git rev-parse --short HEAD") || commitFull.slice(0, 7);
  const rawRef =
    run("git describe --all") || process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || "unknown";
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
