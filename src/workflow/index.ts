export type ValidationPlan = {
  status: "planned" | "blocked";
  commands: Array<{
    command: string;
    args: string[];
    reason: string;
  }>;
};

export function planPythonValidation(paths: string[]): ValidationPlan {
  if (paths.length === 0) {
    return {
      status: "blocked",
      commands: []
    };
  }

  return {
    status: "planned",
    commands: [
      {
        command: "pytest",
        args: paths,
        reason: "Python fixture validation is planned but not executed by the runtime."
      }
    ]
  };
}
