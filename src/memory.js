import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

export const START = "<!-- opencode-memory:index:start -->";
export const END = "<!-- opencode-memory:index:end -->";

export function resolveOptions(options = {}) {
  return {
    memoryDir: options.memoryDir || ".opencode/memory",
    index: options.index || "MEMORY.md",
    maxIndexBytes: Number(options.maxIndexBytes || 25_000),
    maxIndexLines: Number(options.maxIndexLines || 200),
    gitExclude: options.gitExclude !== false,
  };
}

export function repoRoot(cwd = process.cwd()) {
  const proc = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: resolve(cwd), encoding: "utf8" });
  return proc.status === 0 ? proc.stdout.trim() : resolve(cwd);
}

export function ensureProjectMemory(cwd = process.cwd(), options = {}) {
  const opts = resolveOptions(options);
  const repo = repoRoot(cwd);
  const dir = resolve(repo, opts.memoryDir);
  const indexPath = join(dir, opts.index);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(indexPath)) writeFileSync(indexPath, initialIndex(), "utf8");
  if (opts.gitExclude) ensureGitInfoExclude(repo, normalizePattern(opts.memoryDir));
  const entries = listMemoryFiles(dir, opts.index);
  const updated = writeGeneratedIndex(indexPath, entries);
  return { repo, dir, indexPath, entries, updated };
}

export function readMemoryIndex(cwd = process.cwd(), options = {}) {
  const opts = resolveOptions(options);
  const repo = repoRoot(cwd);
  return readMemoryIndexAt(repo, opts);
}

export function memoryContextBlock(cwd = process.cwd(), options = {}) {
  const result = ensureProjectMemory(cwd, options);
  const content = capIndex(readFileSync(result.indexPath, "utf8"), resolveOptions(options));
  return `## Project Memory\n\nThe repo-local project memory index is at \`${relative(result.repo, result.indexPath)}\`. Read listed topic files on demand before making durable assumptions. Write memory only for information likely useful in future sessions.\n\n${content}`.trim();
}

export function memoryContextBlockReadOnly(cwd = process.cwd(), options = {}) {
  const opts = resolveOptions(options);
  const repo = repoRoot(cwd);
  const indexPath = resolve(repo, opts.memoryDir, opts.index);
  const content = readMemoryIndexAt(repo, opts);
  return `## Project Memory\n\nThe repo-local project memory index is at \`${relative(repo, indexPath)}\`. Read listed topic files on demand before making durable assumptions. Write memory only for information likely useful in future sessions.\n\n${content || "(project memory index not found yet)"}`.trim();
}

function readMemoryIndexAt(repo, opts) {
  const indexPath = resolve(repo, opts.memoryDir, opts.index);
  if (!existsSync(indexPath)) return "";
  return capIndex(readFileSync(indexPath, "utf8"), opts);
}

function initialIndex() {
  return `# Project Memory

This file is automatically loaded by the opencode project-memory plugin as a concise memory index.

## Instructions

- Read relevant topic files on demand before making durable assumptions.
- Write memory only when the information is likely useful in future sessions.
- Keep this index concise; put details in topic files and link them from the curated index.
- The generated topic index is maintained automatically. Edit curated sections, not the generated block.

## Curated Index

- Add durable, human-curated memory links here.

## Generated Topic Index

${START}
(no topic files yet)
${END}
`;
}

function writeGeneratedIndex(indexPath, entries) {
  const current = readFileSync(indexPath, "utf8");
  const block = renderGeneratedIndex(entries);
  let next;
  if (current.includes(START) && current.includes(END)) {
    next = current.replace(new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`), block);
  } else {
    next = `${current.trimEnd()}\n\n## Generated Topic Index\n\n${block}\n`;
  }
  if (next !== current) writeFileSync(indexPath, next, "utf8");
  return next !== current;
}

function renderGeneratedIndex(entries) {
  const lines = entries.length
    ? entries.map((entry) => `- \`${entry.path}\`${entry.description ? ` - ${entry.description}` : ""}`)
    : ["(no topic files yet)"];
  return `${START}\n${lines.join("\n")}\n${END}`;
}

function listMemoryFiles(dir, indexName) {
  const files = walk(dir)
    .filter((file) => relative(dir, file) !== indexName)
    .filter((file) => statSync(file).isFile())
    .filter((file) => !relative(dir, file).split(sep).some((part) => part.startsWith(".")))
    .map((file) => {
      const rel = relative(dir, file).split(sep).join("/");
      return { path: rel, description: readDescription(file) };
    });
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function readDescription(file) {
  const first = readFirstLine(file);
  const match = first.match(/^<!--\s*desc:\s*(.*?)\s*-->$/);
  return match ? match[1].trim() : "";
}

function readFirstLine(file) {
  const fd = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(1024);
    const bytes = readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytes).toString("utf8").split(/\r?\n/, 1)[0] || "";
  } finally {
    closeSync(fd);
  }
}

function capIndex(content, opts) {
  const byBytes = capUtf8(content, opts.maxIndexBytes);
  const lines = byBytes.split(/\r?\n/);
  const capped = lines.slice(0, opts.maxIndexLines).join("\n");
  if (capped.length < content.length || lines.length > opts.maxIndexLines) {
    return `${capped}\n\n[Project memory index truncated by plugin cap.]`;
  }
  return capped;
}

function capUtf8(content, maxBytes) {
  const buffer = Buffer.from(content, "utf8");
  if (buffer.length <= maxBytes) return content;
  let end = maxBytes;
  while (end > 0 && (buffer[end] & 0b11000000) === 0b10000000) end -= 1;
  return buffer.subarray(0, end).toString("utf8");
}

function ensureGitInfoExclude(repo, pattern) {
  const proc = spawnSync("git", ["rev-parse", "--git-path", "info/exclude"], { cwd: repo, encoding: "utf8" });
  if (proc.status !== 0) return;
  const excludePath = resolve(repo, proc.stdout.trim());
  mkdirSync(dirname(excludePath), { recursive: true });
  const current = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
  if (current.split(/\r?\n/).includes(pattern)) return;
  appendFileSync(excludePath, `${current.endsWith("\n") || !current ? "" : "\n"}${pattern}\n`);
}

function normalizePattern(memoryDir) {
  return memoryDir.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/?$/, "/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
