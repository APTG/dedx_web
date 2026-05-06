// CommonJS — intentionally NOT a module so it works with plain `node`.
const { execSync } = require("child_process");
const { writeFileSync, mkdirSync } = require("fs");
const { resolve, dirname } = require("path");

function stripHeadsPrefix(ref) {
  return ref.startsWith("heads/") ? ref.slice("heads/".length) : ref;
}
exports.stripHeadsPrefix = stripHeadsPrefix;

function main() {
  const run = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();

  // All three git calls — fail loudly if git is unavailable.
  const commitFull = run("git rev-parse HEAD");
  const commit = run("git rev-parse --short HEAD");
  const rawRef = run("git describe --all");
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
