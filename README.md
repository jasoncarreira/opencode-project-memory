# opencode-project-memory

Claude-Code-style project memory for opencode, backed by a repository-local `MEMORY.md` index. This document describes version 0.1.0 as verified from this repository's package metadata, source, tests, and workflows; it does not assume registry availability or undocumented host behavior.

## Requirements

- Node.js 20 or newer (`>=20`).
- Git for Git-worktree root discovery. Outside a Git worktree, commands fall back to the resolved starting directory.
- An opencode installation for plugin use. The package itself has no production dependencies.

## Installation

Repository evidence does not establish whether `opencode-project-memory@0.1.0` is available from your configured npm registry. If you independently verify that it is available, install it in a consumer project and run its binary from that installation, then register the package:

```sh
npm install opencode-project-memory@0.1.0
./node_modules/.bin/opencode-memory install
```

The fully repository-verified path is to build a tarball from a source checkout and install it into a consumer project:

```sh
# In this source checkout
npm ci
npm pack

# In the consumer project; use the tarball path printed above
npm install /path/to/opencode-project-memory-0.1.0.tgz
./node_modules/.bin/opencode-memory install --local
```

`install --local` is required for this registry-independent path: it registers the plugin file from the installed tarball. Plain `install` records the package name and therefore still depends on the host resolving `opencode-project-memory` through its package-resolution mechanism.

The tarball contains `src`, `README.md`, `LICENSE`, and npm-generated package metadata; repository tests and guides are not packed. From a source checkout, invoke the CLI directly as `node src/cli.js <command>` after `npm ci`; that is development use, not equivalent to installing the packed package and its `opencode-memory` bin.

`install` rewrites `~/.config/opencode/opencode.jsonc` and instructs you to restart opencode. `install --local` instead writes a `file://` URL for `src/plugin.js` in the package containing the **running CLI**. It does not select an arbitrary current checkout based on the invocation directory; run the intended checkout's `node src/cli.js install --local` when developing that checkout.

## Quick start

Register the plugin, refresh an existing repository, and inspect the resulting context:

```sh
./node_modules/.bin/opencode-memory install
./node_modules/.bin/opencode-memory refresh --repo /path/to/repository
./node_modules/.bin/opencode-memory context --repo /path/to/repository
```

All three commands above can write files. Review `.opencode/memory/MEMORY.md`, decide whether its contents are appropriate for model prompts, and restart opencode after registration.

## Repository selection

For `refresh`, `doctor`, and `context`, the starting directory is selected as follows:

1. With no `--repo`, use the invocation's current working directory.
2. `--repo PATH` resolves `PATH` against that working directory. If repeated, the last exact `--repo PATH` occurrence wins.
3. Git discovery runs from that resolved directory. Inside a Git worktree, the Git top-level directory wins; if Git discovery fails, the resolved directory itself is used.

`--repo` is a Git-discovery starting point, not necessarily the final memory root, and it does not apply to `install`. Supported option forms are `install --local` and `refresh|doctor|context --repo PATH`. Forms such as `--repo=PATH`, other options, and extra positionals are unsupported even if the current minimal parser happens to ignore some of them. Use existing directories: a missing value or file-valued root fails, while a nonexistent fallback path may be created as an incidental consequence and should not be relied upon.

## CLI reference

There are no dry-run or confirmation modes. On failure the CLI prints `error: ...`, exits with status 1, and does not roll back earlier writes.

| Command | Reads and mutations | Result and repeat behavior |
|---|---|---|
| no command, `--help`, `-h` | Prints usage; does not mutate repository state. | Exits successfully. |
| `install [--local]` | Creates the global config parent and rewrites `~/.config/opencode/opencode.jsonc`. The default adds `opencode-project-memory`; `--local` adds the running package's plugin file URL. | Initializes `$schema` and `plugin` when absent and deduplicates only the exact plugin spec. Every successful run rewrites JSON, so comments and formatting are not preserved. |
| `refresh [--repo PATH]` | Creates the memory directory/index when absent and rewrites generated index content when needed. | Reports index path, topic count, and whether content changed; repeating it is content-idempotent only when discovered entries are unchanged. |
| `doctor [--repo PATH]` | **Mutating repair/check:** ensures and refreshes memory before reporting index, repository, and topic status. | Can create or rewrite memory; it is not read-only. |
| `context [--repo PATH]` | **Mutating inspection:** ensures and refreshes memory, then reads and prints capped prompt context. | Can create or rewrite memory; it is distinct from the plugin's read-only chat transform. |

Unknown commands fail with status 1. `install` accepts only limited JSONC: whole-line `//` comments and block comments are stripped before `JSON.parse`; inline comments, trailing commas, malformed JSON, or an incompatible `plugin` shape can fail after the config parent has been created.

## Plugin lifecycle

The async plugin factory returns hooks without doing initialization I/O. Its working-directory precedence is `input.cwd`, `input.directory`, `ctx.directory`, `ctx.worktree`, then the host process working directory; this is separate from CLI `--repo` selection.

- Only exact `session.created` and `file.edited` events call the mutating ensure/refresh path. Other events are ignored; there is no continuous watcher.
- When the host invokes `experimental.chat.system.transform` with a truthy `sessionID`, the hook appends one read-only project-memory block. Without a session ID it does nothing. Repository evidence does not establish that the host invokes this for every request.
- The read-only transform does not create a missing index; it emits a placeholder. Event hooks may already have created/refreshed the index.
- There is no shutdown/dispose hook. Filesystem and invalid-output-shape errors are not suppressed and reject to the host; host recovery behavior is unknown.

## Memory files and topic discovery

The default layout is:

```text
.opencode/memory/
  MEMORY.md
  <topic files and directories>
```

The mutating path creates an initial index with curated content and a generated block:

```markdown
<!-- opencode-memory:index:start -->
<!-- opencode-memory:index:end -->
```

Refresh replaces only marker-bounded generated content and preserves content outside it. If the markers are absent, it appends a generated section. Put human-maintained guidance outside the generated block.

Topic discovery recursively includes regular files under the memory directory, excluding the root index and every path containing a dot-prefixed segment. There is no extension allowlist. Entries use slash-normalized lexical paths and lexical ordering. An optional description must be a complete first line matching `<!-- desc: ... -->`; discovery reads at most the first 1,024 bytes of each file to find it.

Symlinks are unsupported and unsafe. Discovery provides no realpath containment or cycle protection, so do not rely on dot-path filtering as a traversal security boundary. Remove symlinks from the memory tree, then inspect both `MEMORY.md` and the content represented by its entries before prompt use.

## Configuration

The CLI has no memory-option flags beyond `--repo`; memory options come only from the options object supplied by the plugin host. This package defines no environment-variable or project-config source for them. For a host supporting opencode's tuple-form plugin options:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "opencode-project-memory",
      {
        "memoryDir": ".opencode/memory",
        "index": "MEMORY.md",
        "maxIndexBytes": 25000,
        "maxIndexLines": 200
      }
    ]
  ]
}
```

| Option | Default | Behavior |
|---|---:|---|
| `memoryDir` | `.opencode/memory` | Memory path resolved from the selected repository root. |
| `index` | `MEMORY.md` | Index path within the memory directory. |
| `maxIndexBytes` | `25000` | UTF-8-safe byte cap on injected index text. |
| `maxIndexLines` | `200` | Line cap applied after the byte cap. |

Use nonempty repository-relative paths and positive finite cap values. The package performs no path sandboxing and no type/range validation; absolute, traversing, nonnumeric, zero, negative, or infinite values are not supported configuration guidance. When either cap truncates content, the exact marker `[Project memory index truncated by plugin cap.]` is appended. Truncation is not redaction.

## Privacy and security boundary

CLI commands and handled events can read topic metadata and persist `MEMORY.md`, including generated lexical topic paths and descriptions. Description discovery reads up to 1,024 bytes from each discovered file. The runtime never changes `.gitignore` or `.git/info/exclude`; whether memory is committed, ignored, or otherwise shared is repository policy. Symlinks are unsupported and unsafe; remove them and inspect the resulting index and represented content rather than assuming repository containment.

When the host invokes the read-only transform, the capped raw index plus fixed instructions becomes system context and may be sent to the configured model provider. Treat curated index content, generated filenames and paths, and descriptions as **untrusted, prompt-injection-capable data**. The plugin inserts that data into privileged system context without escaping, delimiting, or lower-priority isolation. Excluding topic bodies does not make this metadata safe. The package implements no redaction, encryption, sensitivity classification, consent flow, access control, or provider-retention policy. Local persistence and model-provider prompt exposure are separate boundaries: inspect the index and represented content, and avoid secrets or instructions you would not trust in both curated text and discoverable metadata.

## Supported workflows

```sh
# Source-checkout local registration (writes global opencode config)
node src/cli.js install --local

# Refresh from an existing nested directory; Git top-level is selected
./node_modules/.bin/opencode-memory refresh --repo ./existing/nested-directory

# Repair and report memory state (mutating)
./node_modules/.bin/opencode-memory doctor --repo /path/to/repository

# Print prompt context after ensuring/refreshing it (mutating)
./node_modules/.bin/opencode-memory context --repo /path/to/repository
```

To add a topic, create a non-hidden regular file under the memory directory, optionally add a strict first-line description, then run `refresh`. Registration with `install` or `install --local` is exact-spec idempotent, so changing between those forms can leave both distinct entries for you to reconcile.

## Troubleshooting

- **Package cannot be installed:** verify registry availability separately, use Node.js `>=20`, or use the verified local-tarball procedure. Do not confuse `node src/cli.js` source use with a packed consumer installation.
- **Memory appears in an unexpected parent:** Git top-level wins over the `--repo` starting directory. Run `git rev-parse --show-toplevel` there. Outside Git, the resolved starting directory is used.
- **`--repo` fails or behaves unexpectedly:** use exact `--repo PATH` with an existing directory. A missing value or file path fails; `--repo=PATH` and unlisted options are unsupported. Repeated exact options use the last value.
- **Install config fails:** check `~/.config/opencode/opencode.jsonc` for malformed or unsupported JSONC and ensure `plugin` is an array. The command rewrites formatting/comments and has no rollback.
- **Topic is absent:** ensure it is below the memory directory, is not the root index, and no path segment starts with `.`. Descriptions must be a complete first-line marker within the first 1,024 bytes. Remove symlinks and cycles before retrying.
- **Plugin is not loaded:** ensure the configured package or file URL resolves in the host environment, then follow the CLI's restart instruction. Registry status and host plugin-resolution behavior are outside this repository's proof.
- **`doctor` or `context` changed files:** expected; both ensure and refresh memory first. Only the chat transform uses the read-only path.
- **Filesystem error:** path, permission, read, and write errors propagate. Earlier directory/config/index writes are not transactionally rolled back.

## Contributing and releasing

Repository contributors should follow [CONTRIBUTING.md](https://github.com/jasoncarreira/opencode-project-memory/blob/main/CONTRIBUTING.md). Release operators should follow [RELEASING.md](https://github.com/jasoncarreira/opencode-project-memory/blob/main/RELEASING.md). These repository-only guides are not included in the npm tarball, so consumer-critical behavior remains documented here.

## Verification sources

Material claims above are traceable to `package.json`/`package-lock.json`, `src/cli.js`, `src/plugin.js`, `src/memory.js`, `test/memory.test.mjs`, `test/package-smoke.mjs`, and `.github/workflows/{ci,publish}.yml`. Those files establish package and repository behavior, not npm registry availability, model-provider retention, host hook frequency/recovery, or external approval policy.

## License

MIT. See [LICENSE](LICENSE).
