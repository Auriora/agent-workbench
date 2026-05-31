import { makeEnvelope, type ResponseEnvelope } from "../contracts/index.js";
import {
  type RuntimeStatus,
  type RuntimeStatusResult
} from "../application/use-cases/get-repo-status.js";

export type ColdStatusPresentationPayload = {
  status: RuntimeStatus;
  meta: RuntimeStatusResult["meta"];
};

export function toColdStatusPresentationPayload(
  result: RuntimeStatusResult
): ColdStatusPresentationPayload {
  return {
    status: result.status,
    meta: result.meta
  };
}

export function buildColdStatusEnvelope(
  result: RuntimeStatusResult
): ResponseEnvelope<RuntimeStatus> {
  const payload = toColdStatusPresentationPayload(result);
  return makeEnvelope({
    data: payload.status,
    meta: payload.meta
  });
}

export const buildStatusEnvelope = buildColdStatusEnvelope;
