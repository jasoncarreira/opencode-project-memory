import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(repoRoot, path), "utf8");
const packageJson = JSON.parse(read("package.json"));
const readme = read("README.md");
const contributing = read("CONTRIBUTING.md");
const releasing = read("RELEASING.md");
const ciWorkflow = read(".github/workflows/ci.yml");
const publishWorkflow = read(".github/workflows/publish.yml");

function section(document, heading) {
  const marker = `## ${heading}`;
  const start = document.indexOf(marker);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  assert.ok(start === 0 || document[start - 1] === "\n", `heading is not line-aligned: ${heading}`);
  const contentStart = start + marker.length;
  const end = document.indexOf("\n## ", contentStart);
  return document.slice(contentStart, end === -1 ? document.length : end);
}

function assertIncludesAll(text, phrases, contract) {
  for (const phrase of phrases) {
    assert.ok(text.includes(phrase), `${contract}: missing ${JSON.stringify(phrase)}`);
  }
}

function shellBlocks(document) {
  return [...document.matchAll(/```sh\n([\s\S]*?)```/g)].map((match) => match[1]).join("\n");
}

test("README requirements and installation stay aligned with package metadata", () => {
  assert.equal(packageJson.engines.node, ">=20");
  assert.match(section(readme, "Requirements"), /Node\.js 20 or newer \(`>=20`\)/);

  const installation = section(readme, "Installation");
  assert.match(installation, /does not establish whether `opencode-project-memory@0\.1\.0` is available/);
  assert.match(installation, /If you independently verify that it is available/);
  assert.match(installation, /fully repository-verified path[\s\S]*tarball/);
  assert.match(installation, /`node src\/cli\.js <command>`/);
  assert.match(installation, /`install --local`[\s\S]*package containing the \*\*running CLI\*\*/);

  const recommendedCommands = shellBlocks(readme);
  assert.doesNotMatch(recommendedCommands, /(?:^|\s)npx\s/m);
  assert.doesNotMatch(recommendedCommands, /npm\s+(?:install|i)\s+(?:[^\n]*\s)?-(?:g|-global)\b/m);
  assert.doesNotMatch(recommendedCommands, /npm\s+link\b/m);
});

test("README links repository guides and retains the required semantic headings", () => {
  for (const heading of [
    "Requirements",
    "Installation",
    "Repository selection",
    "CLI reference",
    "Plugin lifecycle",
    "Memory files and topic discovery",
    "Configuration",
    "Privacy and security boundary",
    "Supported workflows",
    "Troubleshooting",
    "Contributing and releasing",
    "Verification sources",
    "License",
  ]) {
    section(readme, heading);
  }
  assert.match(readme, /\[CONTRIBUTING\.md\]\(CONTRIBUTING\.md\)/);
  assert.match(readme, /\[RELEASING\.md\]\(RELEASING\.md\)/);
});

test("CLI mutation table and repository selection describe only supported exact syntax", () => {
  const cli = section(readme, "CLI reference");
  assert.match(cli, /\| `install \[--local\]` \|[^\n]*(?:rewrites|writes)[^\n]*\|/);
  assert.match(cli, /\| `refresh \[--repo PATH\]` \|[^\n]*(?:creates|rewrites)[^\n]*\|/);
  assert.match(cli, /\| `doctor \[--repo PATH\]` \|[^\n]*\*\*Mutating repair\/check:\*\*[^\n]*not read-only/);
  assert.match(cli, /\| `context \[--repo PATH\]` \|[^\n]*\*\*Mutating inspection:\*\*[^\n]*(?:create|rewrite)/);
  assert.doesNotMatch(cli, /doctor[^\n|]*\|[^\n]*\bis read-only\b/i);
  assert.doesNotMatch(cli, /context[^\n|]*\|[^\n]*\bis read-only\b/i);
  assert.match(cli, /no dry-run or confirmation modes/i);
  assert.match(cli, /does not roll back earlier writes/i);

  const selection = section(readme, "Repository selection");
  assertIncludesAll(
    selection,
    [
      "With no `--repo`, use the invocation's current working directory.",
      "`--repo PATH` resolves `PATH` against that working directory.",
      "the last exact `--repo PATH` occurrence wins",
      "Git top-level directory wins",
      "if Git discovery fails, the resolved directory itself is used",
      "Supported option forms are `install --local` and `refresh|doctor|context --repo PATH`.",
      "`--repo=PATH`",
      "unsupported",
    ],
    "repository selection",
  );
});

test("plugin lifecycle claims preserve event, transform timing, and error boundaries", () => {
  const lifecycle = section(readme, "Plugin lifecycle");
  assertIncludesAll(
    lifecycle,
    [
      "returns hooks without doing initialization I/O",
      "`input.cwd`, `input.directory`, `ctx.directory`, `ctx.worktree`",
      "Only exact `session.created` and `file.edited` events",
      "there is no continuous watcher",
      "host invokes `experimental.chat.system.transform` with a truthy `sessionID`",
      "appends one read-only project-memory block",
      "Without a session ID it does nothing",
      "does not establish that the host invokes this for every request",
      "There is no shutdown/dispose hook",
      "errors are not suppressed and reject to the host",
    ],
    "plugin lifecycle",
  );
});

test("configuration documents defaults, supported guidance, cap order, and truncation", () => {
  const config = section(readme, "Configuration");
  assert.match(config, /options object supplied by the plugin host/);
  assert.match(config, /no environment-variable or project-config source/);
  assert.match(config, /\| `memoryDir` \| `\.opencode\/memory` \|/);
  assert.match(config, /\| `index` \| `MEMORY\.md` \|/);
  assert.match(config, /\| `maxIndexBytes` \| `25000` \|[^\n]*UTF-8-safe byte cap/);
  assert.match(config, /\| `maxIndexLines` \| `200` \|[^\n]*applied after the byte cap/);
  assert.match(config, /nonempty repository-relative paths and positive finite cap values/);
  assert.match(config, /no path sandboxing and no type\/range validation/);
  assert.match(config, /exact marker `\[Project memory index truncated by plugin cap\.\]`/);
  assert.match(config, /Truncation is not redaction/);
});

test("discovery and symlink warnings define recursive, lexical, and 1,024-byte boundaries", () => {
  const discovery = section(readme, "Memory files and topic discovery");
  assertIncludesAll(
    discovery,
    [
      "recursively includes regular files",
      "excluding the root index and every path containing a dot-prefixed segment",
      "There is no extension allowlist",
      "slash-normalized lexical paths and lexical ordering",
      "complete first line matching `<!-- desc: ... -->`",
      "first 1,024 bytes",
      "Symlinks are followed",
      "directory links are traversed and indexed under lexical link paths",
      "no realpath containment check, visited-directory set, or cycle detection",
      "dot-path filtering is not a traversal security boundary",
      "repository-contained and symlink-free",
      "inspect `MEMORY.md` before prompt use",
    ],
    "topic discovery",
  );
});

test("privacy distinguishes local persistence from provider system context", () => {
  const privacy = section(readme, "Privacy and security boundary");
  assert.match(privacy, /persist `MEMORY\.md`/);
  assert.match(privacy, /generated lexical topic paths and descriptions/);
  assert.match(privacy, /up to 1,024 bytes from local files or followed link targets/);
  assert.match(privacy, /runtime never changes `\.gitignore`/);
  assert.match(privacy, /host invokes the read-only transform/);
  assert.match(privacy, /becomes system context and may be sent to the configured model provider/);
  assert.match(privacy, /including descriptions read through symlinks/);
  assert.match(privacy, /Topic bodies are not directly injected/);
  assert.match(privacy, /no redaction, encryption, sensitivity classification, consent flow, access control, or provider-retention policy/);
  assert.match(privacy, /Local persistence and model-provider prompt exposure are separate boundaries/);
});

test("contributor guide stays aligned with package scripts and CI", () => {
  assert.match(contributing, /Node\.js 20 or newer \(`>=20`\)/);
  assert.match(contributing, /```sh\nnpm ci\n```/);
  assert.match(contributing, /```sh\nnpm run check\n```/);
  assertIncludesAll(
    contributing,
    ["`npm test`", "`npm run pack-smoke`", "`npm pack --dry-run`", "Node.js 22 and 24", "pull requests", "pushes to `main`"],
    "contributor checks",
  );
  assert.equal(packageJson.scripts["pack-smoke"], "node --test test/package-smoke.mjs");
  assert.equal(packageJson.scripts.check, "npm test && npm run pack-smoke && npm pack --dry-run");
  assert.match(ciWorkflow, /node-version: \[22, 24\]/);
  assert.match(ciWorkflow, /branches: \[main\]/);
  assert.match(ciWorkflow, /pull_request:/);
  assert.match(ciWorkflow, /run: npm ci/);
  assert.match(ciWorkflow, /run: npm run check/);

  const warnings = section(contributing, "Mutation warnings");
  assertIncludesAll(warnings, ["mutate this checkout's project memory", "not substitutes for `npm run check`", "npm run refresh", "npm run doctor:local"], "maintenance scripts");
  assert.equal(packageJson.scripts.refresh, "node src/cli.js refresh --repo .");
  assert.equal(packageJson.scripts["doctor:local"], "node src/cli.js doctor --repo .");
});

test("release guide dynamically matches package metadata and publish workflow", () => {
  const versionTag = `v${packageJson.version}`;
  assert.ok(releasing.includes(versionTag));
  assert.match(releasing, /`v\*` tag triggers the workflow/);
  assert.match(releasing, /must exactly equal `v` plus `package\.json\.version`/);
  assert.match(releasing, /`GITHUB_REF_NAME` exactly equals `v\$\{package\.json\.version\}`/);
  assert.match(releasing, /Node\.js 24/);
  assert.match(releasing, /GitHub Actions Environment `npm`/);
  assert.match(releasing, /`contents: read` and `id-token: write`/);
  assert.match(releasing, /`https:\/\/registry\.npmjs\.org`/);
  assert.match(releasing, /`publishConfig\.access: public`/);
  assert.match(releasing, /Run `npm run check`/);
  assert.match(releasing, /Run `npm publish`/);
  assert.match(releasing, /failure[\s\S]*prevents the later `npm publish` step/i);
  assert.match(releasing, /does not provide automatic versioning, changelog generation, GitHub Release creation/);
  assert.match(releasing, /does not claim npm provenance, known registry availability/);
  assert.match(releasing, /credential\/approval configuration/);

  assert.equal(packageJson.publishConfig.access, "public");
  assert.match(publishWorkflow, /tags:\s*\n\s*- ["']v\*["']/);
  assert.match(publishWorkflow, /environment: npm/);
  assert.match(publishWorkflow, /contents: read/);
  assert.match(publishWorkflow, /id-token: write/);
  assert.match(publishWorkflow, /node-version: 24/);
  assert.match(publishWorkflow, /registry-url: https:\/\/registry\.npmjs\.org/);
  assert.match(publishWorkflow, /GITHUB_REF_NAME !== expected/);
  assert.match(publishWorkflow, /`v\$\{require\("\.\/package\.json"\)\.version\}`/);
  assert.match(publishWorkflow, /run: npm run check/);
  assert.match(publishWorkflow, /run: npm publish/);
});

test("documents do not contradict the shared mutation and external-evidence boundaries", () => {
  const allDocs = `${readme}\n${contributing}\n${releasing}`;
  assert.doesNotMatch(allDocs, /(?:doctor|context)[^\n.]{0,80}\bis read-only\b/i);
  assert.doesNotMatch(allDocs, /(?:published|available) (?:on|from) npm(?:js)?\b/i);
  assert.doesNotMatch(allDocs, /(?:every|each) (?:chat|request|prompt)[^\n.]{0,80}(?:transform|inject)/i);
  assert.match(allDocs, /registry availability/);
  assert.match(allDocs, /external (?:credentials and approvals|settings|facts)/);
});
