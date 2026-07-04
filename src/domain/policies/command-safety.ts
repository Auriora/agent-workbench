/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type PlannedCommand = {
  command: string;
  args: string[];
  source: "discovered" | "configured" | "user_requested" | "inferred";
};

export type CommandDecision =
  | {
      allowed: true;
      command: PlannedCommand;
    }
  | {
      allowed: false;
      reason: "command_refused";
      message: string;
      command: PlannedCommand;
    };

const shellMetacharacterPattern = /[;&|`$<>]/;

export function planCommand(command: PlannedCommand): CommandDecision {
  const parts = [command.command, ...command.args];
  const unsafePart = parts.find((part) => shellMetacharacterPattern.test(part));

  if (unsafePart) {
    return {
      allowed: false,
      reason: "command_refused",
      message: `Command part contains shell metacharacters: ${unsafePart}`,
      command
    };
  }

  return {
    allowed: true,
    command
  };
}
