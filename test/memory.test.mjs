import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ensureProjectMemory, memoryContextBlock, memoryContextBlockReadOnly } from "../src/memory.js";

function withTempRepo(callback) {
  const repo = mkdtempSync(join(tmpdir(), "opencode-memory-test-"));
  try {
    return callback(repo);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

test("ensureProjectMemory preserves curated content and refreshes the generated index", () => {
  withTempRepo((repo) => {
    const memoryDir = join(repo, ".opencode", "memory");
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(
      join(memoryDir, "MEMORY.md"),
      `# Project Memory

## Curated Index

- Keep this curated note.

## Generated Topic Index

<!-- opencode-memory:index:start -->
- stale entry
<!-- opencode-memory:index:end -->
`,
      "utf8",
    );
    writeFileSync(join(memoryDir, "preferences.md"), "<!-- desc: Durable preferences -->\n# Preferences\n", "utf8");
    mkdirSync(join(memoryDir, ".private"));
    writeFileSync(join(memoryDir, ".private", "secret.md"), "# Secret\n", "utf8");

    const result = ensureProjectMemory(repo);
    const index = readFileSync(result.indexPath, "utf8");

    assert.equal(result.entries.length, 1);
    assert.match(index, /Keep this curated note/);
    assert.match(index, /`preferences\.md` - Durable preferences/);
    assert.doesNotMatch(index, /stale entry/);
    assert.doesNotMatch(index, /secret\.md/);
  });
});

test("memoryContextBlock creates memory files for explicit CLI context", () => {
  withTempRepo((repo) => {
    const context = memoryContextBlock(repo);

    assert.match(context, /## Project Memory/);
    assert.match(context, /\.opencode\/memory\/MEMORY\.md/);
    assert.equal(existsSync(join(repo, ".opencode", "memory", "MEMORY.md")), true);
  });
});

test("memoryContextBlockReadOnly does not create memory files during chat injection", () => {
  withTempRepo((repo) => {
    const context = memoryContextBlockReadOnly(repo);

    assert.match(context, /project memory index not found yet/);
    assert.equal(existsSync(join(repo, ".opencode")), false);
  });
});
