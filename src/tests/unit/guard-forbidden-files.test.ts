import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";

const scriptPath = path.join(process.cwd(), "scripts/guard-forbidden-files.cjs");
const tempRepos: string[] = [];

function runGitCommand(args: string[], cwd: string) {
  const command = "git";
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
  return result;
}

async function makeRepo() {
  const repo = await mkdtemp(path.join(tmpdir(), "dedx-guard-test-"));
  tempRepos.push(repo);
  runGitCommand(["init", "-q"], repo);
  runGitCommand(["config", "user.email", "guard@example.test"], repo);
  runGitCommand(["config", "user.name", "Guard Test"], repo);
  await writeFile(path.join(repo, "README.md"), "baseline\n");
  runGitCommand(["add", "README.md"], repo);
  runGitCommand(["commit", "-q", "-m", "baseline"], repo);
  return repo;
}

/**
 * Commits a synthetic submodule gitlink without checking out a real submodule.
 * Git stores submodule entries with mode 160000 and a commit SHA.
 */
function commitVendorGitlink(
  repo: string,
  sha: string,
  message: string,
  gitlinkPath = "vendor/svelte",
) {
  runGitCommand(["update-index", "--add", "--cacheinfo", `160000,${sha},${gitlinkPath}`], repo);
  runGitCommand(["commit", "-q", "-m", message], repo);
}

/** Runs the guard script against the most recent commit in the test repository. */
function runGuard(repo: string) {
  return spawnSync(process.execPath, [scriptPath, "--range", "HEAD~1..HEAD"], {
    cwd: repo,
    encoding: "utf8",
  });
}

afterEach(async () => {
  await Promise.all(tempRepos.splice(0).map((repo) => rm(repo, { recursive: true, force: true })));
});

describe("guard-forbidden-files", () => {
  test("allows scoped vendor-only gitlink bump PRs", async () => {
    const repo = await makeRepo();
    await mkdir(path.join(repo, "vendor"), { recursive: true });
    commitVendorGitlink(repo, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "add vendor gitlink");
    commitVendorGitlink(repo, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "bump vendor gitlink");

    const result = runGuard(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Guard check passed");
  });

  test("rejects vendor gitlink changes mixed with first-party files", async () => {
    const repo = await makeRepo();
    await mkdir(path.join(repo, "vendor"), { recursive: true });
    commitVendorGitlink(repo, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "add vendor gitlink");
    await mkdir(path.join(repo, "src"), { recursive: true });
    await writeFile(path.join(repo, "src", "app.ts"), "export const value = 1;\n");
    runGitCommand(
      [
        "update-index",
        "--cacheinfo",
        "160000,bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,vendor/svelte",
      ],
      repo,
    );
    runGitCommand(["add", "src/app.ts"], repo);
    runGitCommand(["commit", "-q", "-m", "mix app and vendor changes"], repo);

    const result = runGuard(repo);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("forbidden vendor gitlink change: vendor/svelte");
  });

  test("rejects generated artifacts", async () => {
    const repo = await makeRepo();
    await mkdir(path.join(repo, "build"), { recursive: true });
    await writeFile(path.join(repo, "build", "artifact.txt"), "generated\n");
    runGitCommand(["add", "build/artifact.txt"], repo);
    runGitCommand(["commit", "-q", "-m", "add generated artifact"], repo);

    const result = runGuard(repo);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("forbidden generated/artifact path: build/artifact.txt");
  });
});
