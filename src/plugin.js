import { ensureProjectMemory, memoryContextBlockReadOnly } from "./memory.js";

function cwdFrom(ctx = {}, input = {}) {
  return input.cwd || input.directory || ctx.directory || ctx.worktree || process.cwd();
}

export default async function projectMemoryPlugin(ctx = {}, options = {}) {
  return {
    event: async (input = {}) => {
      const event = input.event || input;
      if (["session.created", "file.edited"].includes(event.type)) {
        ensureProjectMemory(cwdFrom(ctx, input), options);
      }
    },

    "experimental.chat.system.transform": async (input = {}, output = {}) => {
      if (!input.sessionID) return;
      output.system ??= [];
      output.system.push(memoryContextBlockReadOnly(cwdFrom(ctx, input), options));
    },

  };
}
