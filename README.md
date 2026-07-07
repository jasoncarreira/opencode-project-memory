# opencode-project-memory

Claude-Code-style project memory for opencode using a repo-local `MEMORY.md` index.

The plugin keeps durable project notes under:

```text
.opencode/memory/
  MEMORY.md
  <topic files>
```

`MEMORY.md` stays concise. Humans and agents edit the curated sections, while the plugin maintains only the generated topic-list block between these markers:

```markdown
<!-- opencode-memory:index:start -->
<!-- opencode-memory:index:end -->
```

## Install

Install the published package and register it with opencode:

```sh
npm install -g opencode-project-memory
opencode-memory install
```

Restart opencode after installing or changing plugin config. opencode loads plugin config only at startup.

You can also configure the package manually in `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-project-memory"]
}
```

## Usage

Initialize or refresh a repo's memory index:

```sh
opencode-memory refresh --repo /path/to/repo
```

Check that the memory index is present and readable:

```sh
opencode-memory doctor --repo /path/to/repo
```

Print the context block the plugin injects into opencode sessions:

```sh
opencode-memory context --repo /path/to/repo
```

After `refresh`, add topic files next to `MEMORY.md`. Topic file descriptions are optional. Put a first-line description comment in a topic file to show it in the generated index:

```markdown
<!-- desc: User preferences and durable project conventions -->
# Preferences
```

## Config

Use tuple form when you want non-default plugin options:

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

Options:

- `memoryDir`: repo-relative memory directory. Default: `.opencode/memory`.
- `index`: index filename inside `memoryDir`. Default: `MEMORY.md`.
- `maxIndexBytes`: maximum injected index bytes. Default: `25000`.
- `maxIndexLines`: maximum injected index lines. Default: `200`.

## Behavior

- Creates `.opencode/memory/MEMORY.md` when you run `refresh`, `doctor`, or `context`.
- Regenerates the generated topic index from files under `.opencode/memory/`.
- Injects capped `MEMORY.md` content into session system prompts for each model request.
- Uses read-only injection during chat so a missing memory index is not created just because a session starts.
- Does not call a model, summarize files, or automatically decide what is worth remembering.
- Does not modify `.gitignore` or `.git/info/exclude`; decide per project whether memory should be tracked.

## Local Development

For local plugin development:

```sh
npm link
opencode-memory install --local
```

`--local` writes a `file://` plugin URL that points at the current checkout or installed package. Use the default `install` command for published-package usage.

## Release Checks

Run the deterministic package checks before publishing:

```sh
npm test
npm run pack-smoke
npm run check
```

`npm run pack-smoke` creates an npm tarball, installs it into a scratch consumer project, imports the plugin from `node_modules`, exercises the CLI binary, and verifies isolated opencode config installation.

Inspect the exact publish contents with:

```sh
npm pack --dry-run
```

## Troubleshooting

- Restart opencode after `opencode-memory install`; running sessions keep the old plugin config.
- If the plugin is configured but memory is not visible, run `opencode-memory context --repo /path/to/repo` to inspect the injected block.
- If `MEMORY.md` is missing, run `opencode-memory refresh --repo /path/to/repo`.
- If you want shared team memory, commit `.opencode/memory/`. If memory is personal, keep it ignored or excluded.
