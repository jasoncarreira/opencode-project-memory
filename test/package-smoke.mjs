import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function withTempDir(callback) {
  const dir = mkdtempSync(join(tmpdir(), "opencode-memory-pack-"));
  try {
    return callback(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with status ${result.status}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result;
}

function packInto(dir) {
  const result = run("npm", ["pack", "--json", "--pack-destination", dir]);
  const [pack] = JSON.parse(result.stdout);
  return {
    tarball: join(dir, pack.filename),
    files: new Set(pack.files.map((file) => file.path)),
  };
}

function installPackedPackage(dir) {
  const pack = packInto(dir);
  const consumer = join(dir, "consumer");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }, null, 2), "utf8");
  run("npm", ["install", "--silent", "--no-audit", "--no-fund", pack.tarball], { cwd: consumer });
  return { ...pack, consumer, bin: join(consumer, "node_modules", ".bin", process.platform === "win32" ? "opencode-memory.cmd" : "opencode-memory") };
}

test("npm pack includes the publishable runtime surface", () => {
  withTempDir((dir) => {
    const { files } = packInto(dir);

    assert.equal(files.has("package.json"), true);
    assert.equal(files.has("README.md"), true);
    assert.equal(files.has("LICENSE"), true);
    assert.equal(files.has("src/plugin.js"), true);
    assert.equal(files.has("src/cli.js"), true);
    assert.equal(files.has("src/memory.js"), true);
    assert.equal(files.has(".opencode/memory/MEMORY.md"), false);
    assert.equal(files.has("test/package-smoke.mjs"), false);
  });
});

test("packed install exposes the plugin export and CLI binary", () => {
  withTempDir((dir) => {
    const { bin, consumer } = installPackedPackage(dir);

    const imported = run(
      "node",
      [
        "--input-type=module",
        "--eval",
        `const mod = await import("opencode-project-memory");
const hooks = await mod.default({ directory: process.cwd() }, {});
if (typeof hooks.event !== "function") throw new Error("missing event hook");
if (typeof hooks["experimental.chat.system.transform"] !== "function") throw new Error("missing system transform hook");
console.log("ok");`,
      ],
      { cwd: consumer },
    );

    assert.equal(imported.stdout.trim(), "ok");
    assert.match(run(bin, ["--help"], { cwd: consumer }).stdout, /opencode-memory/);
  });
});

test("packed CLI manages memory in a fresh project", () => {
  withTempDir((dir) => {
    const { bin, consumer } = installPackedPackage(dir);
    const project = join(dir, "project");
    mkdirSync(project);

    run(bin, ["refresh", "--repo", project], { cwd: consumer });
    const memoryDir = join(project, ".opencode", "memory");
    const indexPath = join(memoryDir, "MEMORY.md");
    assert.equal(existsSync(indexPath), true);

    writeFileSync(join(memoryDir, "decisions.md"), "<!-- desc: Durable decisions -->\n# Decisions\n", "utf8");
    run(bin, ["refresh", "--repo", project], { cwd: consumer });
    assert.match(readFileSync(indexPath, "utf8"), /`decisions\.md` - Durable decisions/);
    assert.match(run(bin, ["doctor", "--repo", project], { cwd: consumer }).stdout, /ok: memory index/);
    assert.match(run(bin, ["context", "--repo", project], { cwd: consumer }).stdout, /Project Memory/);
  });
});

test("packed CLI install writes idempotent opencode plugin config in an isolated HOME", () => {
  withTempDir((dir) => {
    const { bin, consumer } = installPackedPackage(dir);
    const home = join(dir, "home");
    mkdirSync(home);
    const env = { HOME: home, USERPROFILE: home };

    assert.match(run(bin, ["install"], { cwd: consumer, env }).stdout, /restart opencode/);
    run(bin, ["install"], { cwd: consumer, env });

    const configPath = join(home, ".config", "opencode", "opencode.jsonc");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(config.$schema, "https://opencode.ai/config.json");
    assert.deepEqual(config.plugin, ["opencode-project-memory"]);
  });
});
