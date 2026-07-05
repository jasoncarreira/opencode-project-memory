#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { ensureProjectMemory, memoryContextBlock, repoRoot } from "./memory.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function usage() {
  console.log(`opencode-memory

Commands:
  install [--local]             Add this package to ~/.config/opencode/opencode.jsonc
  refresh [--repo PATH]         Create/update .opencode/memory/MEMORY.md
  doctor [--repo PATH]          Check project memory state
  context [--repo PATH]         Print the compaction context block
`);
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "--help" || cmd === "-h") return usage();
  if (cmd === "install") return install(rest);
  if (cmd === "refresh") return refresh(rest);
  if (cmd === "doctor") return doctor(rest);
  if (cmd === "context") return console.log(memoryContextBlock(options(rest).cwd));
  throw new Error(`unknown command: ${cmd}`);
}

function install(args) {
  const local = args.includes("--local");
  const configPath = join(homedir(), ".config", "opencode", "opencode.jsonc");
  mkdirSync(dirname(configPath), { recursive: true });
  const pluginSpec = local ? pathToFileURL(join(root, "src", "plugin.js")).href : "opencode-project-memory";
  const cfg = readConfig(configPath);
  cfg.$schema ??= "https://opencode.ai/config.json";
  cfg.plugin ??= [];
  if (!hasPlugin(cfg.plugin, pluginSpec)) cfg.plugin.push(pluginSpec);
  writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`configured opencode plugin: ${pluginSpec}`);
  console.log(`updated: ${configPath}`);
  console.log("restart opencode for plugin changes to take effect");
}

function refresh(args) {
  const result = ensureProjectMemory(options(args).cwd);
  console.log(`memory index: ${result.indexPath}`);
  console.log(`topic files: ${result.entries.length}`);
  console.log(`updated: ${result.updated}`);
}

function doctor(args) {
  const opts = options(args);
  const repo = repoRoot(opts.cwd);
  const result = ensureProjectMemory(repo);
  const ok = existsSync(result.indexPath);
  console.log(`${ok ? "ok" : "missing"}: memory index (${result.indexPath})`);
  console.log(`ok: repo (${repo})`);
  console.log(`ok: topic files (${result.entries.length})`);
  process.exitCode = ok ? 0 : 1;
}

function options(args) {
  const opts = { cwd: process.cwd() };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--repo") opts.cwd = resolve(args[++index]);
  }
  return opts;
}

function readConfig(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  return stripped ? JSON.parse(stripped) : {};
}

function hasPlugin(plugins, spec) {
  return plugins.some((entry) => (Array.isArray(entry) ? entry[0] : entry) === spec);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
