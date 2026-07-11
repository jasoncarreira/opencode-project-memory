import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(repoRoot, path), "utf8");
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
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
  assert.match(installation, /npm install \/path\/to\/opencode-project-memory-0\.1\.0\.tgz[\s\S]*opencode-memory install --local/);
  assert.match(installation, /`install --local` is required[\s\S]*registers the plugin file from the installed tarball/);
  assert.match(installation, /Plain `install`[\s\S]*depends on the host resolving `opencode-project-memory`/);
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
  assert.match(readme, /\[CONTRIBUTING\.md\]\(https:\/\/github\.com\/jasoncarreira\/opencode-project-memory\/blob\/main\/CONTRIBUTING\.md\)/);
  assert.match(readme, /\[RELEASING\.md\]\(https:\/\/github\.com\/jasoncarreira\/opencode-project-memory\/blob\/main\/RELEASING\.md\)/);

  const packedTopLevelFiles = new Set(packageJson.files.filter((entry) => !entry.includes("/")));
  for (const match of readme.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)#]+)(?:#[^)]+)?\)/g)) {
    assert.ok(packedTopLevelFiles.has(match[1]), `README relative link target is not packed: ${match[1]}`);
  }
});

test("CLI mutation table and repository selection describe only supported exact syntax", () => {
  const cli = section(readme, "CLI reference");
  assert.match(cli, /\| no command, `--help`, `-h` \|[^\n]*Prints usage; does not mutate repository state\.[^\n]*Exits successfully/);
  assert.match(cli, /\| `install \[--local\]` \|[^\n]*(?:rewrites|writes)[^\n]*\|/);
  assert.match(cli, /\| `refresh \[--repo PATH\]` \|[^\n]*(?:creates|rewrites)[^\n]*\|/);
  assert.match(cli, /\| `doctor \[--repo PATH\]` \|[^\n]*\*\*Mutating repair\/check:\*\*[^\n]*not read-only/);
  assert.match(cli, /\| `context \[--repo PATH\]` \|[^\n]*\*\*Mutating inspection:\*\*[^\n]*(?:create|rewrite)/);
  assert.doesNotMatch(cli, /doctor[^\n|]*\|[^\n]*\bis read-only\b/i);
  assert.doesNotMatch(cli, /context[^\n|]*\|[^\n]*\bis read-only\b/i);
  assert.match(cli, /no dry-run or confirmation modes/i);
  assert.match(cli, /does not roll back earlier writes/i);
  assert.match(cli, /Unknown commands fail with status 1/);

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

test("install contract covers config mutation, exact-spec idempotency, and failures", () => {
  const installation = section(readme, "Installation");
  const cli = section(readme, "CLI reference");
  const troubleshooting = section(readme, "Troubleshooting");

  assert.match(installation, /`install` rewrites `~\/\.config\/opencode\/opencode\.jsonc`/);
  assert.match(installation, /instructs you to restart opencode/);
  assert.match(cli, /Creates the global config parent and rewrites `~\/\.config\/opencode\/opencode\.jsonc`/);
  assert.match(cli, /default adds `opencode-project-memory`/);
  assert.match(cli, /`--local` adds the running package's plugin file URL/);
  assert.match(cli, /Initializes `\$schema` and `plugin` when absent/);
  assert.match(cli, /deduplicates only the exact plugin spec/);
  assert.match(cli, /Every successful run rewrites JSON, so comments and formatting are not preserved/);
  assert.match(cli, /whole-line `\/\/` comments and block comments are stripped before `JSON\.parse`/);
  assert.match(cli, /inline comments, trailing commas, malformed JSON, or an incompatible `plugin` shape can fail after the config parent has been created/);
  assert.match(troubleshooting, /Install config fails:[^\n]*malformed or unsupported JSONC[^\n]*`plugin` is an array/);
  assert.match(troubleshooting, /rewrites formatting\/comments and has no rollback/);
});

test("CLI failure guidance covers invalid repositories, I/O, and partial writes", () => {
  const selection = section(readme, "Repository selection");
  const cli = section(readme, "CLI reference");
  const troubleshooting = section(readme, "Troubleshooting");

  assert.match(cli, /prints `error: \.\.\.`/);
  assert.match(cli, /exits with status 1/);
  assert.match(selection, /missing value or file-valued root fails/);
  assert.match(selection, /nonexistent fallback path may be created as an incidental consequence and should not be relied upon/);
  assert.match(troubleshooting, /use exact `--repo PATH` with an existing directory/);
  assert.match(troubleshooting, /A missing value or file path fails/);
  assert.match(troubleshooting, /path, permission, read, and write errors propagate/);
  assert.match(troubleshooting, /Earlier directory\/config\/index writes are not transactionally rolled back/);
});

test("plugin lifecycle claims preserve event, transform timing, and error boundaries", () => {
  const lifecycle = section(readme, "Plugin lifecycle");
  assertIncludesAll(
    lifecycle,
    [
      "returns hooks without doing initialization I/O",
      "`input.cwd`, `input.directory`, `ctx.directory`, `ctx.worktree`",
      "then the host process working directory",
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

test("README workflows cover only verified registration and mutating operations", () => {
  const installation = section(readme, "Installation");
  const workflows = section(readme, "Supported workflows");
  assert.match(installation, /\.\/node_modules\/\.bin\/opencode-memory install/);
  assertIncludesAll(
    workflows,
    [
      "node src/cli.js install --local",
      "refresh --repo ./existing/nested-directory",
      "Git top-level is selected",
      "doctor --repo /path/to/repository",
      "Repair and report memory state (mutating)",
      "context --repo /path/to/repository",
      "Print prompt context after ensuring/refreshing it (mutating)",
      "create a non-hidden regular file",
      "strict first-line description",
      "then run `refresh`",
      "exact-spec idempotent",
    ],
    "supported workflows",
  );
});

test("troubleshooting covers each source-verified operator failure category", () => {
  const troubleshooting = section(readme, "Troubleshooting");
  for (const category of [
    "Package cannot be installed",
    "Memory appears in an unexpected parent",
    "`--repo` fails or behaves unexpectedly",
    "Install config fails",
    "Topic is absent",
    "Plugin is not loaded",
    "`doctor` or `context` changed files",
    "Filesystem error",
  ]) {
    assert.ok(troubleshooting.includes(`**${category}:**`), `missing troubleshooting category: ${category}`);
  }
  assert.match(troubleshooting, /Node\.js `>=20`/);
  assert.match(troubleshooting, /local-tarball procedure/);
  assert.match(troubleshooting, /Git top-level wins/);
  assert.match(troubleshooting, /`--repo=PATH` and unlisted options are unsupported/);
  assert.match(troubleshooting, /complete first-line marker within the first 1,024 bytes/);
  assert.match(troubleshooting, /configured package or file URL resolves[\s\S]*restart instruction/);
  assert.match(troubleshooting, /both ensure and refresh memory first/);
});

test("README package facts stay dynamically aligned with publishable metadata", () => {
  assert.match(readme, new RegExp(`version ${packageJson.version.replaceAll(".", "\\.")}`));
  assert.equal(packageJson.main, "src/plugin.js");
  assert.deepEqual(packageJson.exports, { ".": "./src/plugin.js", "./cli": "./src/cli.js" });
  assert.deepEqual(packageJson.bin, { "opencode-memory": "src/cli.js" });
  assert.deepEqual(packageJson.files, ["src", "README.md", "LICENSE"]);
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageLock.packages[""].dependencies, undefined);
  assert.match(section(readme, "Requirements"), /package itself has no production dependencies/);
  assert.match(section(readme, "Installation"), /tarball contains `src`, `README\.md`, `LICENSE`, and npm-generated package metadata/);
  assert.match(section(readme, "Installation"), /tests and guides are not packed/);
  assert.match(section(readme, "Verification sources"), /not npm registry availability/);
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

test("discovery defines safe regular-file boundaries and warns that symlinks are unsupported", () => {
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
      "Symlinks are unsupported and unsafe",
      "no realpath containment or cycle protection",
      "do not rely on dot-path filtering as a traversal security boundary",
      "Remove symlinks from the memory tree",
      "inspect both `MEMORY.md` and the content represented by its entries before prompt use",
    ],
    "topic discovery",
  );
});

test("privacy warns that untrusted metadata enters privileged system context", () => {
  const privacy = section(readme, "Privacy and security boundary");
  assert.match(privacy, /persist `MEMORY\.md`/);
  assert.match(privacy, /generated lexical topic paths and descriptions/);
  assert.match(privacy, /up to 1,024 bytes from each discovered file/);
  assert.match(privacy, /runtime never changes `\.gitignore`/);
  assert.match(privacy, /Symlinks are unsupported and unsafe/);
  assert.match(privacy, /remove them and inspect the resulting index and represented content/);
  assert.match(privacy, /host invokes the read-only transform/);
  assert.match(privacy, /becomes system context and may be sent to the configured model provider/);
  assert.match(privacy, /curated index content, generated filenames and paths, and descriptions/);
  assert.match(privacy, /untrusted, prompt-injection-capable data/);
  assert.match(privacy, /inserts that data into privileged system context/);
  assert.match(privacy, /without escaping, delimiting, or lower-priority isolation/);
  assert.match(privacy, /Excluding topic bodies does not make this metadata safe/);
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

test("contributor guarantees cover claim policy, test ownership, isolation, and releases", () => {
  assert.match(section(contributing, "Prerequisites"), /No lint, formatting, or typecheck script is defined/);
  const claimPolicy = section(contributing, "Documentation claim policy");
  assert.match(claimPolicy, /claims must be supported by package metadata, implementation, tests, or workflows/);
  assert.match(claimPolicy, /Qualify external facts that the repository cannot prove/);
  assert.match(claimPolicy, /Keep the packed `README\.md` consumer-complete/);
  assert.match(claimPolicy, /Do not promote permissive parser quirks, unchecked paths, pathological cap coercion, or symlink traversal as supported behavior/);

  const ownership = section(contributing, "Test ownership");
  assert.match(ownership, /semantic documentation-contract tests rather than prose snapshots/);
  assert.match(ownership, /Tests must be deterministic and offline/);
  assert.match(ownership, /temporary repositories and `HOME`\/`USERPROFILE` locations/);
  assert.match(ownership, /never run config-install tests against a developer's real home/);
  assert.match(section(contributing, "Releases"), /\[RELEASING\.md\]\(RELEASING\.md\)/);
  assert.match(section(contributing, "Releases"), /Do not publish or create release tags as part of an ordinary contribution/);
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
  assert.match(releasing, /Query npm for the exact package version/);
  assert.match(releasing, /only when that exact version is absent/);
  assert.match(releasing, /already exists[\s\S]*without attempting a duplicate publication/);
  assert.match(section(releasing, "Validate"), /```sh\nnpm ci\nnpm run check\n```/);
  assert.match(section(releasing, "Workflow stages"), /Run `npm ci`/);
  assert.match(releasing, /failure[\s\S]*prevents the later `npm publish` step/i);
  assert.match(releasing, /does not provide automatic versioning, changelog generation, GitHub Release creation/);
  assert.match(releasing, /does not claim npm provenance, known registry availability/);
  assert.match(releasing, /credential\/approval configuration/);
  const rollback = section(releasing, "Failure and rollback");
  assert.match(rollback, /no npm unpublish, deprecation, registry rollback, or tag-recovery automation/);
  assert.match(rollback, /follow the current npm and repository-owner policy outside this workflow/);

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
  assert.match(publishWorkflow, /name: Check registry version[\s\S]*id: registry/);
  assert.match(publishWorkflow, /registry\.npmjs\.org[\s\S]*response\.status !== 200 && response\.status !== 404/);
  assert.match(publishWorkflow, /GITHUB_OUTPUT[\s\S]*published=\$\{response\.status === 200\}/);
  assert.match(publishWorkflow, /if: steps\.registry\.outputs\.published != 'true'[\s\S]*run: npm publish/);
  assert.match(publishWorkflow, /if: steps\.registry\.outputs\.published == 'true'[\s\S]*skipping npm publish/);
  assert.match(publishWorkflow, /run: npm publish/);
});

test("documents consistently preserve mutation, lifecycle, and installation boundaries", () => {
  const allDocs = `${readme}\n${contributing}\n${releasing}`;
  assert.doesNotMatch(allDocs, /(?:doctor|context)[^\n.]{0,80}\bis read-only\b/i);
  assert.doesNotMatch(allDocs, /(?:published|available) (?:on|from) npm(?:js)?\b/i);
  assert.doesNotMatch(allDocs, /(?:every|each) (?:chat|request|prompt)[^\n.]{0,80}(?:transform|inject)/i);
  assert.match(section(readme, "CLI reference"), /doctor[^\n]*Mutating[\s\S]*context[^\n]*Mutating/);
  assert.match(section(contributing, "Mutation warnings"), /`refresh`, `doctor`, and `context` calls can create or rewrite/);
  assert.match(section(readme, "Plugin lifecycle"), /host recovery behavior is unknown/);
  assert.match(section(contributing, "Documentation claim policy"), /opencode host timing\/recovery/);
  for (const document of [readme, contributing, releasing]) assert.match(document, /registry availability/);
});

test("documents consistently preserve configuration, privacy, contribution, and release boundaries", () => {
  const config = section(readme, "Configuration");
  const policy = section(contributing, "Documentation claim policy");
  assert.match(config, /no path sandboxing and no type\/range validation/);
  assert.match(policy, /unchecked paths[\s\S]*not promote[\s\S]*supported behavior|Do not promote[\s\S]*unchecked paths[\s\S]*supported behavior/);

  assert.match(section(readme, "Privacy and security boundary"), /may be sent to the configured model provider/);
  assert.match(policy, /model-provider retention/);
  assert.match(section(readme, "Contributing and releasing"), /\[CONTRIBUTING\.md\]\(https:\/\/github\.com\/jasoncarreira\/opencode-project-memory\/blob\/main\/CONTRIBUTING\.md\)/);
  assert.match(section(contributing, "Required checks"), /npm run check/);
  assert.match(section(readme, "Contributing and releasing"), /\[RELEASING\.md\]\(https:\/\/github\.com\/jasoncarreira\/opencode-project-memory\/blob\/main\/RELEASING\.md\)/);
  assert.match(section(contributing, "Releases"), /\[RELEASING\.md\]\(RELEASING\.md\)/);
  assert.match(section(releasing, "Evidence boundary"), /does not establish that a version is registry-available/);
  assert.match(section(releasing, "Credentials and approvals"), /external approvals may be required/);
  assert.match(section(releasing, "Not automated"), /does not provide automatic versioning/);
});
