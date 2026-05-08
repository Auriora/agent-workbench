import { makeEnvelope, type ResponseEnvelope } from "../contracts/index.js";
import {
  type RuntimeStatus,
  type RuntimeStatusResult
} from "../application/use-cases/get-repo-status.js";

export function buildColdStatusEnvelope(
  result: RuntimeStatusResult
): ResponseEnvelope<RuntimeStatus> {
  return makeEnvelope({
    data: result.status,
    meta: result.meta
  });
}
