# opencode-project-memory

Claude-Code-style project memory for opencode.

The plugin keeps a repo-local memory directory:

```text
.opencode/memory/
  MEMORY.md
  <topic files>
```

`MEMORY.md` is a concise index. The plugin automatically maintains only the generated topic-list block between these markers:

```markdown
<!-- opencode-memory:index:start -->
<!-- opencode-memory:index:end -->
```

Everything else is agent- or human-curated.

## Install Locally

```sh
npm link
opencode-memory install --local
```

Restart opencode after installing the plugin.

## Commands

```sh
opencode-memory refresh --repo /path/to/repo
opencode-memory doctor --repo /path/to/repo
opencode-memory context --repo /path/to/repo
```

## Behavior

- Creates `.opencode/memory/MEMORY.md` if missing.
- Regenerates the generated topic index from files under `.opencode/memory/`.
- Injects the capped `MEMORY.md` content into session system prompts for each model request.
- Does not inject memory into compaction, so memory content is not repeatedly summarized into session history.
- Does not call a model, summarize files, or automatically decide what is worth remembering.
- Does not modify `.gitignore` or `.git/info/exclude`; decide per project whether memory should be tracked.

Topic file descriptions are optional. Put a first-line description comment in a topic file to show it in the generated index:

```markdown
<!-- desc: User preferences and durable project conventions -->
# Preferences
```

## Config

```jsonc
{
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
