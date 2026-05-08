import { z, type ZodTypeAny } from "zod";

export function parseMcpArguments<T extends ZodTypeAny>(
  schema: T,
  input: unknown
): z.infer<T> {
  return schema.parse(input ?? {});
}

export type McpArgumentParser<T extends ZodTypeAny> = (input: unknown) => z.infer<T>;
