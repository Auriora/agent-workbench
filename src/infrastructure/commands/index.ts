export type CommandInput = {
  command: string;
  args?: string[];
};

export type CommandOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export class NoopCommandAdapter {
  public async execute(_input: CommandInput): Promise<CommandOutput> {
    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  }
}

export function createNoopCommandAdapter(): NoopCommandAdapter {
  return new NoopCommandAdapter();
}
