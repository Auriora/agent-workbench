/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type { MessagePort } from "node:worker_threads";
import type { GraphBuildWatchObservation, GraphBuildWatchPort } from "../../ports/index.js";

export type GraphBuildObservationIdentity = {
  execution_id: string;
  target_snapshot_id: string;
  controller_generation: number;
  invalidation_generation: number;
  watcher_epoch: string;
};

export type GraphBuildObservationRequest = GraphBuildObservationIdentity & {
  type: "graph_build_observation_request";
  request_id: string;
  operation: "observe" | "register_directory";
  path?: string;
  repository_key?: string;
};

export type GraphBuildObservationAcknowledgement = GraphBuildObservationIdentity & {
  type: "graph_build_observation_ack";
  request_id: string;
  accepted: boolean;
  result?: GraphBuildWatchObservation;
  error?: string;
};

type ObservationMessagePort = Pick<MessagePort, "on" | "off" | "postMessage">;

/**
 * Worker-side proxy for the controller-owned watch session. It never creates a
 * watcher: every call is authenticated against the execution fence and served
 * by the parent process.
 */
export function createGraphBuildObservationClient(input: {
  port: ObservationMessagePort;
  identity: GraphBuildObservationIdentity;
  initial_observation: GraphBuildWatchObservation;
}): Pick<GraphBuildWatchPort, "start" | "registerDirectory"> & { close(): void } {
  assertIdentity(input.identity);
  assertObservation(input.initial_observation, input.identity.watcher_epoch, ".");

  const pending = new Map<string, {
    request: GraphBuildObservationRequest;
    resolve: (observation: GraphBuildWatchObservation) => void;
    reject: (error: Error) => void;
  }>();
  const acknowledged = new Set<string>();
  let counter = 0;
  let failure: Error | undefined;

  const fail = (error: Error): void => {
    if (failure !== undefined) return;
    failure = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  const onMessage = (message: unknown): void => {
    if (!isAcknowledgement(message)) return;
    if (acknowledged.has(message.request_id)) {
      fail(new Error(`Duplicate graph-build observation acknowledgement: ${message.request_id}`));
      return;
    }
    const request = pending.get(message.request_id);
    if (request === undefined) {
      fail(new Error(`Unexpected graph-build observation acknowledgement: ${message.request_id}`));
      return;
    }
    if (!sameIdentity(message, request.request)) {
      pending.delete(message.request_id);
      const protocolError = new Error(`Mismatched graph-build observation acknowledgement: ${message.request_id}`);
      request.reject(protocolError);
      fail(protocolError);
      return;
    }
    acknowledged.add(message.request_id);
    pending.delete(message.request_id);
    if (!message.accepted || message.result === undefined) {
      request.reject(new Error(message.error ?? "Graph-build observation request was rejected."));
      return;
    }
    try {
      assertObservation(
        message.result,
        input.identity.watcher_epoch,
        request.request.operation === "register_directory" ? request.request.path! : "."
      );
      request.resolve(message.result);
    } catch (error) {
      const protocolError = toError(error);
      request.reject(protocolError);
      fail(protocolError);
    }
  };
  input.port.on("message", onMessage);

  const request = (operation: GraphBuildObservationRequest["operation"], requestedPath?: string, repositoryKey?: string): Promise<GraphBuildWatchObservation> => {
    if (failure !== undefined) return Promise.reject(failure);
    const pathValue = operation === "register_directory" ? normalizeRelativePath(requestedPath) : undefined;
    const request_id = `${input.identity.execution_id}:observation:${counter++}`;
    const message: GraphBuildObservationRequest = {
      type: "graph_build_observation_request",
      request_id,
      ...input.identity,
      operation,
      ...(pathValue === undefined ? {} : { path: pathValue }),
      ...(repositoryKey === undefined ? {} : { repository_key: normalizeRepositoryKey(repositoryKey) })
    };
    return new Promise<GraphBuildWatchObservation>((resolve, reject) => {
      pending.set(request_id, { request: message, resolve, reject });
      try {
        input.port.postMessage(message);
      } catch (error) {
        pending.delete(request_id);
        const postError = toError(error);
        reject(postError);
        fail(postError);
      }
    });
  };

  return {
    // A start is a fresh parent observation of the existing watch session.
    start: async () => request("observe"),
    registerDirectory: async ({ path: directory, repository_key }) => request("register_directory", directory, repository_key),
    close: () => {
      input.port.off("message", onMessage);
      fail(new Error("Graph-build observation client closed."));
    }
  };
}

function isAcknowledgement(value: unknown): value is GraphBuildObservationAcknowledgement {
  return typeof value === "object" && value !== null &&
    (value as { type?: unknown }).type === "graph_build_observation_ack" &&
    typeof (value as { request_id?: unknown }).request_id === "string";
}

function sameIdentity(
  acknowledgement: GraphBuildObservationAcknowledgement,
  request: GraphBuildObservationRequest
): boolean {
  return acknowledgement.execution_id === request.execution_id &&
    acknowledgement.target_snapshot_id === request.target_snapshot_id &&
    acknowledgement.controller_generation === request.controller_generation &&
    acknowledgement.invalidation_generation === request.invalidation_generation &&
    acknowledgement.watcher_epoch === request.watcher_epoch;
}

function assertIdentity(identity: GraphBuildObservationIdentity): void {
  if (identity.execution_id.length === 0 || identity.target_snapshot_id.length === 0 || identity.watcher_epoch.length === 0 ||
    !Number.isSafeInteger(identity.controller_generation) || identity.controller_generation < 0 ||
    !Number.isSafeInteger(identity.invalidation_generation) || identity.invalidation_generation < 0) {
    throw new TypeError("Graph-build observation identity is invalid.");
  }
}

function assertObservation(
  observation: GraphBuildWatchObservation,
  epoch: string,
  requiredDirectory: string
): void {
  if (observation.epoch !== epoch || !observation.healthy || !Number.isSafeInteger(observation.sequence) ||
    observation.sequence < 0 || !Number.isSafeInteger(observation.pending_events) || observation.pending_events < 0 ||
    !observation.covered_directories.includes(requiredDirectory)) {
    throw new Error("Graph-build watch observation does not cover the requested directory.");
  }
}

function normalizeRelativePath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096 || value.includes("\0")) {
    throw new TypeError("Graph-build watch directory must be a bounded relative path.");
  }
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/, "") || ".";
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    throw new TypeError("Graph-build watch directory must be a bounded relative path.");
  }
  return normalized;
}

function normalizeRepositoryKey(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || value.includes("\0")) {
    throw new TypeError("Graph-build repository key must be bounded text.");
  }
  return value;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
