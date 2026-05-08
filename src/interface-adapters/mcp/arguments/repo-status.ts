import { z } from "zod";
import { parseMcpArguments, type McpArgumentParser } from "./index.js";

const repoStatusArgumentSchema = z
  .object({
    repo_root: z.string().optional()
  })
  .passthrough();

export type RepoStatusArguments = z.infer<typeof repoStatusArgumentSchema>;

export const parseRepoStatusArguments: McpArgumentParser<
  typeof repoStatusArgumentSchema
> = (input) => parseMcpArguments(repoStatusArgumentSchema, input);
