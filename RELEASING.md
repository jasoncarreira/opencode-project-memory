# Releasing

## Evidence boundary

This guide describes the repository-defined workflow for versioned npm publication. It does not establish that a version is registry-available, that a publisher is authorized, that publication has succeeded, or how external credentials and approvals are configured.

## Prerequisites

- Permission to push release tags to this repository.
- Node.js 20 or newer locally; the publish job itself uses Node.js 24.
- npm publication authorization for `opencode-project-memory` and any required approval for the GitHub Actions Environment `npm`.

The credential source, npm trusted-publisher configuration, environment protection rules, and approval policy are external settings and cannot be verified from this repository.

## Prepare metadata

Update and review `package.json` version and associated release content before tagging. The tag must exactly equal `v` plus `package.json.version`; for package version `0.1.0`, the only accepted release tag is `v0.1.0`.

The repository does not automatically choose or increment the version.

## Validate

Install from the lockfile and run the same aggregate check used by CI and publication:

```sh
npm ci
npm run check
```

Review `npm pack --dry-run` output (also run by `npm run check`) and confirm the package metadata is ready. The package declares `publishConfig.access: public`.

## Create and push the tag

After the intended release commit is reviewed and validated:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Replace the example with exactly `v<package.json version>`. Pushing any `v*` tag triggers the workflow, but a tag that does not exactly match the checked-out package version fails validation before publication.

## Workflow stages

`.github/workflows/publish.yml` runs one publish job on GitHub-hosted Ubuntu:

1. Enter GitHub Actions Environment `npm`.
2. Grant workflow permissions `contents: read` and `id-token: write`.
3. Check out the tagged revision.
4. Configure Node.js 24 for `https://registry.npmjs.org`.
5. Run `npm ci`.
6. Verify `GITHUB_REF_NAME` exactly equals `v${package.json.version}`.
7. Run `npm run check`.
8. Run `npm publish` using the package's public-access metadata.

Public-access metadata, the npmjs registry URL, and OIDC permission do not by themselves prove registry availability, publication authorization, successful publication, npm trusted-publisher setup, credentials, or environment approval rules.

## Credentials and approvals

An authorized npm publication identity and external approvals may be required. The workflow exposes `id-token: write` and targets Environment `npm`, but contains no repository secret reference that identifies a credential source. Confirm current npm and GitHub environment settings with authorized maintainers without recording secrets in this repository.

## Failure and rollback

A failure in install, exact tag/version validation, or checks prevents the later `npm publish` step. Inspect the failed job and fix the underlying source or metadata in a new commit; do not move or reuse a published release tag without an explicit project policy.

This repository defines no npm unpublish, deprecation, registry rollback, or tag-recovery automation. If publication itself partially succeeds or an external approval blocks the job, follow the current npm and repository-owner policy outside this workflow.

## Not automated

The workflow does not provide automatic versioning, changelog generation, GitHub Release creation, or repository-defined rollback. It does not claim npm provenance, known registry availability, hidden registry settings, successful publication, or any particular credential/approval configuration.
