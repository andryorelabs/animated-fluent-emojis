// oxlint-disable-next-line unicorn-js/name-replacements -- git fixes the hook name commit-msg
import { fileURLToPath } from "node:url";

import { spawnInherited } from "./pre-commit.ts";

/**
 * Builds the commitlint command for a commit message file.
 * @param messageFile - The path git passes to the commit-msg hook.
 * @returns The argv to run, or undefined when no message file was given.
 */
export function buildCommitMessageCommand(messageFile: string | undefined): string[] | undefined {
  return messageFile === undefined || messageFile === ""
    ? undefined
    : ["bunx", "commitlint", "--edit", messageFile];
}

/**
 * Lints the commit message file with commitlint.
 * @param messageFile - The path git passes to the commit-msg hook.
 * @param run - Executes an argv and returns its exit status.
 * @returns The exit code the hook must end with; 1 when no message file was given.
 */
export function runCommitMessage(
  messageFile: string | undefined,
  run: (argv: readonly string[]) => number,
): number {
  const command = buildCommitMessageCommand(messageFile);
  if (command === undefined) {
    console.error("commit-msg: no commit message file was provided");
    return 1;
  }
  return run(command);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runCommitMessage(process.argv[2], spawnInherited);
}
