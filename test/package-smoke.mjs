import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function withTempDir(callback) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "opencode-memory-pack-")));
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
  const home = join(dir, "home");
  mkdirSync(consumer);
  mkdirSync(home);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }, null, 2), "utf8");
  const env = {
    HOME: home,
    USERPROFILE: home,
    npm_config_cache: join(dir, "npm-cache"),
    npm_config_offline: "true",
    npm_config_userconfig: join(home, ".npmrc"),
  };
  const npmEnv = {
    npm_config_cache: env.npm_config_cache,
    npm_config_offline: env.npm_config_offline,
    npm_config_userconfig: env.npm_config_userconfig,
  };
  run("npm", ["install", "--silent", "--no-audit", "--no-fund", pack.tarball], { cwd: consumer, env: npmEnv });
  return {
    ...pack,
    consumer,
    home,
    env,
    bin: join(consumer, "node_modules", ".bin", process.platform === "win32" ? "opencode-memory.cmd" : "opencode-memory"),
  };
}

function initGitRepo(repo, env) {
  mkdirSync(repo, { recursive: true });
  run("git", ["init", "--quiet", repo], { env });
}

function descriptionLineOfLength(length) {
  const prefix = "<!-- desc: ";
  const suffix = " -->";
  assert.ok(length >= prefix.length + suffix.length);
  return `${prefix}${"x".repeat(length - prefix.length - suffix.length)}${suffix}`;
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
    const { bin, consumer, env } = installPackedPackage(dir);
    const project = join(dir, "project");
    mkdirSync(project);

    run(bin, ["refresh", "--repo", project], { cwd: consumer, env });
    const memoryDir = join(project, ".opencode", "memory");
    const indexPath = join(memoryDir, "MEMORY.md");
    assert.equal(existsSync(indexPath), true);

    writeFileSync(join(memoryDir, "decisions.md"), "<!-- desc: Durable decisions -->\n# Decisions\n", "utf8");
    run(bin, ["refresh", "--repo", project], { cwd: consumer, env });
    assert.match(readFileSync(indexPath, "utf8"), /`decisions\.md` - Durable decisions/);
    assert.match(run(bin, ["doctor", "--repo", project], { cwd: consumer, env }).stdout, /ok: memory index/);
    assert.match(run(bin, ["context", "--repo", project], { cwd: consumer, env }).stdout, /Project Memory/);
  });
});

test("packed CLI applies omitted, relative, and repeated --repo precedence before Git-root selection", () => {
  withTempDir((dir) => {
    const { bin, env } = installPackedPackage(dir);
    const invocation = join(dir, "invocation");
    const omittedRepo = join(dir, "omitted-repo");
    const relativeRepo = join(dir, "relative-repo");
    const repeatedFirstRepo = join(dir, "repeated-first-repo");
    const repeatedFinalRepo = join(dir, "repeated-final-repo");
    mkdirSync(invocation);

    for (const repo of [omittedRepo, relativeRepo, repeatedFirstRepo, repeatedFinalRepo]) {
      initGitRepo(repo, env);
      mkdirSync(join(repo, "nested", "project"), { recursive: true });
    }

    const omittedNested = join(omittedRepo, "nested", "project");
    run(bin, ["refresh"], { cwd: omittedNested, env });
    assert.equal(existsSync(join(omittedRepo, ".opencode", "memory", "MEMORY.md")), true);
    assert.equal(existsSync(join(omittedNested, ".opencode")), false);

    run(bin, ["refresh", "--repo", "../relative-repo/nested/project"], { cwd: invocation, env });
    assert.equal(existsSync(join(relativeRepo, ".opencode", "memory", "MEMORY.md")), true);
    assert.equal(existsSync(join(relativeRepo, "nested", "project", ".opencode")), false);

    run(
      bin,
      [
        "refresh",
        "--repo",
        "../repeated-first-repo/nested/project",
        "--repo",
        "../repeated-final-repo/nested/project",
      ],
      { cwd: invocation, env },
    );
    assert.equal(existsSync(join(repeatedFirstRepo, ".opencode")), false);
    assert.equal(existsSync(join(repeatedFinalRepo, ".opencode", "memory", "MEMORY.md")), true);
    assert.equal(existsSync(join(repeatedFinalRepo, "nested", "project", ".opencode")), false);
    assert.equal(existsSync(join(invocation, ".opencode")), false);
  });
});

test("packed doctor and context create indexes in separate fresh non-Git directories", () => {
  withTempDir((dir) => {
    const { bin, consumer, env } = installPackedPackage(dir);
    const doctorProject = join(dir, "doctor-project");
    const contextProject = join(dir, "context-project");
    mkdirSync(doctorProject);
    mkdirSync(contextProject);

    const doctor = run(bin, ["doctor", "--repo", doctorProject], { cwd: consumer, env });
    assert.match(doctor.stdout, /ok: memory index/);
    assert.equal(existsSync(join(doctorProject, ".opencode", "memory", "MEMORY.md")), true);

    const context = run(bin, ["context", "--repo", contextProject], { cwd: consumer, env });
    assert.match(context.stdout, /## Project Memory/);
    assert.equal(existsSync(join(contextProject, ".opencode", "memory", "MEMORY.md")), true);
  });
});

test("packed discovery follows external file and directory symlinks without injecting topic bodies", (t) => {
  withTempDir((dir) => {
    const { bin, consumer, env } = installPackedPackage(dir);
    const project = join(dir, "project");
    const memoryDir = join(project, ".opencode", "memory");
    const externalDir = join(dir, "external-directory");
    const externalFile = join(dir, "external-file.md");
    mkdirSync(memoryDir, { recursive: true });
    mkdirSync(externalDir);
    writeFileSync(externalFile, "<!-- desc: External file description -->\nEXTERNAL_FILE_BODY_SENTINEL\n", "utf8");
    writeFileSync(
      join(externalDir, "nested.md"),
      "<!-- desc: External directory description -->\nEXTERNAL_DIRECTORY_BODY_SENTINEL\n",
      "utf8",
    );

    try {
      symlinkSync(externalFile, join(memoryDir, "linked-file.md"), "file");
      symlinkSync(externalDir, join(memoryDir, "linked-directory"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EACCES", "ENOSYS", "EPERM"].includes(error.code)) {
        t.skip(`symlinks unsupported: ${error.code}`);
        return;
      }
      throw error;
    }

    writeFileSync(join(memoryDir, "accepted.md"), `${descriptionLineOfLength(1024)}\nACCEPTED_BODY_SENTINEL\n`, "utf8");
    writeFileSync(join(memoryDir, "rejected.md"), `${descriptionLineOfLength(1025)}\nREJECTED_BODY_SENTINEL\n`, "utf8");

    run(bin, ["refresh", "--repo", project], { cwd: consumer, env });
    const index = readFileSync(join(memoryDir, "MEMORY.md"), "utf8");
    assert.match(index, /`linked-file\.md` - External file description/);
    assert.match(index, /`linked-directory\/nested\.md` - External directory description/);
    assert.match(index, new RegExp(`\`accepted\\.md\` - ${"x".repeat(1009)}`));
    assert.match(index, /`rejected\.md`\n/);
    assert.doesNotMatch(index, /`rejected\.md` -/);

    const transformed = run(
      "node",
      [
        "--input-type=module",
        "--eval",
        `const mod = await import("opencode-project-memory");
const hooks = await mod.default({ directory: ${JSON.stringify(project)} }, {});
const output = { system: [] };
await hooks["experimental.chat.system.transform"]({ sessionID: "packed-smoke" }, output);
console.log(JSON.stringify(output.system));`,
      ],
      { cwd: consumer, env },
    );
    const system = JSON.parse(transformed.stdout).join("\n");
    assert.match(system, /`linked-file\.md` - External file description/);
    assert.match(system, /`linked-directory\/nested\.md` - External directory description/);
    assert.doesNotMatch(system, /EXTERNAL_FILE_BODY_SENTINEL/);
    assert.doesNotMatch(system, /EXTERNAL_DIRECTORY_BODY_SENTINEL/);
    assert.doesNotMatch(system, /ACCEPTED_BODY_SENTINEL|REJECTED_BODY_SENTINEL/);
  });
});

test("packed CLI install writes idempotent opencode plugin config in an isolated HOME", () => {
  withTempDir((dir) => {
    const { bin, consumer, env, home } = installPackedPackage(dir);

    assert.match(run(bin, ["install"], { cwd: consumer, env }).stdout, /restart opencode/);
    run(bin, ["install"], { cwd: consumer, env });

    const configPath = join(home, ".config", "opencode", "opencode.jsonc");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(config.$schema, "https://opencode.ai/config.json");
    assert.deepEqual(config.plugin, ["opencode-project-memory"]);
  });
});

test("packed CLI install --local records the installed package plugin file URL", () => {
  withTempDir((dir) => {
    const { bin, consumer, env, home } = installPackedPackage(dir);

    run(bin, ["install", "--local"], { cwd: consumer, env });

    const configPath = join(home, ".config", "opencode", "opencode.jsonc");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    const expected = pathToFileURL(join(consumer, "node_modules", "opencode-project-memory", "src", "plugin.js")).href;
    assert.deepEqual(config.plugin, [expected]);
  });
});
