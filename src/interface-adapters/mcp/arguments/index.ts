import { ZodError, z, type ZodTypeAny } from "zod";

export function parseMcpArguments<T extends ZodTypeAny>(
  schema: T,
  input: unknown
): z.infer<T> {
  return schema.parse(input ?? {});
}

export type McpArgumentParser<T extends ZodTypeAny> = (input: unknown) => z.infer<T>;

export function isMcpArgumentError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

export function formatMcpArgumentError(
  error: unknown,
  fallbackMessage = "Invalid MCP arguments."
): string {
  if (!isMcpArgumentError(error)) {
    return fallbackMessage;
  }

  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}

export const repoRootArgument = z.string().min(1);

export const repoPathArgument = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith("/") && !value.startsWith("\\"), {
    message: "Expected a repo-relative path."
  })
  .refine((value) => !value.split(/[\\/]+/u).includes(".."), {
    message: "Parent path traversal is not allowed."
  });

export const sourcePositionArgument = z
  .object({
    line: z.number().int().positive(),
    column: z.number().int().nonnegative()
  })
  .strict();

export const sourceRangeArgument = z
  .object({
    start_line: z.number().int().positive(),
    start_column: z.number().int().nonnegative(),
    end_line: z.number().int().positive(),
    end_column: z.number().int().nonnegative()
  })
  .strict()
  .refine(
    (value) =>
      value.end_line > value.start_line ||
      (value.end_line === value.start_line && value.end_column >= value.start_column),
    {
      message: "Source range end must not precede start."
    }
  );

export function boundedRowLimitArgument(max: number, defaultValue: number) {
  return z.number().int().positive().max(max).default(defaultValue);
}

export function traversalDepthArgument(max: number, defaultValue: number) {
  return z.number().int().positive().max(max).default(defaultValue);
}

export function enumArgument<const T extends [string, ...string[]]>(values: T) {
  return z.enum(values);
}

export const payloadModeArgument = z.enum([
  "metadata_only",
  "bounded_source",
  "full_payload"
]);

export const usageContextArgument = z.record(z.string(), z.string()).default({});

export const editOperationArgument = z.enum(["bounded_text_edit"]);

export const validationTargetArgument = repoPathArgument;
