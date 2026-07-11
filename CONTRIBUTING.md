# Contributing

## Prerequisites

- Node.js 20 or newer (`>=20`)
- npm and Git

No lint, formatting, or typecheck script is defined by this repository; do not substitute an unrelated local check for the required package check.

## Install dependencies

From the repository root, install exactly the lockfile state:

```sh
npm ci
```

## Required checks

Before submitting changes, run:

```sh
npm run check
```

That script runs, in order:

1. `npm test` — the configured Node test suite, including memory behavior and public documentation-contract coverage.
2. `npm run pack-smoke` — packs the package, installs it into temporary consumers, and verifies the packed runtime, exports, binary, CLI behavior, and isolated config behavior.
3. `npm pack --dry-run` — reports the publishable package contents.

CI runs `npm ci` and `npm run check` on Node.js 22 and 24 for pull requests and pushes to `main`.

## Documentation claim policy

Public behavioral claims must be supported by package metadata, implementation, tests, or workflows. Qualify external facts that the repository cannot prove, including npm registry availability, opencode host timing/recovery, model-provider retention, credentials, and approval settings. Keep the packed `README.md` consumer-complete; repository-only contributor or release detail belongs in these guides.

When changing a public contract, reconcile `README.md`, `CONTRIBUTING.md`, and `RELEASING.md` and add only narrow deterministic coverage where needed. Do not promote permissive parser quirks, unchecked paths, pathological cap coercion, or symlink traversal as supported behavior.

## Test ownership

- Memory creation, generated-index preservation/discovery, capping, and read-only context belong in focused memory tests.
- Packed files, installation, exports, CLI behavior, Git-root selection, and platform-sensitive file URLs belong in packed smoke tests using temporary consumers and isolated homes.
- Stable wording/metadata/workflow alignment belongs in semantic documentation-contract tests rather than prose snapshots.

Tests must be deterministic and offline. Use temporary repositories and `HOME`/`USERPROFILE` locations; never run config-install tests against a developer's real home.

## Mutation warnings

These convenience scripts mutate this checkout's project memory and are not substitutes for `npm run check`:

```sh
npm run refresh
npm run doctor:local
```

Likewise, direct CLI `refresh`, `doctor`, and `context` calls can create or rewrite project-memory files, while `install` can rewrite the user's opencode config. Inspect the target and isolate the home directory in tests.

## Releases

Release operators must follow [RELEASING.md](RELEASING.md). Do not publish or create release tags as part of an ordinary contribution.
