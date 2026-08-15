/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import { PostHog, type EventMessage, type PostHogOptions } from "posthog-node";
import type { TelemetryRecorderPort } from "../../ports/index.js";
import { AGENT_WORKBENCH_RUNTIME_VERSION } from "../../runtime/version.js";

export const POSTHOG_EU_INGESTION_HOST = "https://eu.i.posthog.com";
const POSTHOG_SHUTDOWN_TIMEOUT_MS = 1_000;

declare const __AGENT_WORKBENCH_DISTRIBUTION_ANALYTICS_ENABLED__: boolean;
declare const __AGENT_WORKBENCH_DISTRIBUTION_POSTHOG_PROJECT_TOKEN__: string;

type AnalyticsConfigurationStatus =
  | "disabled"
  | "ready"
  | "missing_configuration"
  | "invalid_host";

export type PostHogAnalyticsConfig = {
  enabled: boolean;
  status: AnalyticsConfigurationStatus;
  projectToken?: string;
  host?: string;
};

export type PostHogDistributionDefaults = {
  enabled: boolean;
  projectToken?: string;
  host?: string;
};

export type PostHogCaptureClient = {
  capture(message: EventMessage): void;
  captureException(
    error: unknown,
    distinctId?: string,
    additionalProperties?: Record<string, unknown>
  ): void;
  flush(): Promise<void>;
  shutdown(timeoutMs?: number): Promise<void>;
  on?(event: "error", listener: (error: unknown) => void): unknown;
};

export type PostHogClientFactory = (
  projectToken: string,
  options: PostHogOptions
) => PostHogCaptureClient;

type SafeScalar = string | number | boolean;

export type SanitizedPostHogEvent = {
  event: "mcp.tool.dispatch" | "mcp.resource.dispatch" | "runtime.boundary" | "runtime.error";
  properties: Record<string, SafeScalar>;
};

const EVENT_NAMES = new Set<SanitizedPostHogEvent["event"]>([
  "mcp.tool.dispatch",
  "mcp.resource.dispatch",
  "runtime.boundary",
  "runtime.error"
]);

const OUTCOMES = new Set(["ok", "blocked", "degraded", "error", "failed", "missing"]);
const SURFACE_KINDS = new Set(["tool", "resource"]);
const BOUNDARY_KINDS = new Set([
  "use_case",
  "graph_query",
  "worker",
  "cache",
  "presentation",
  "degraded_state",
  "error_boundary"
]);
const BOOLEAN_PROPERTIES = new Set([
  "truncated",
  "markdown_audit_complete"
]);
const MARKDOWN_AUDIT_PROPERTIES = new Set([
  "markdown_audit_total_documents",
  "markdown_audit_chunk_size",
  "markdown_audit_checked_count",
  "markdown_audit_skipped_count",
  "markdown_audit_checked_clean_count",
  "markdown_audit_checked_with_findings_count",
  "markdown_audit_budget_truncated_count",
  "markdown_audit_finding_count",
  "markdown_audit_returned_finding_count",
  "markdown_audit_unchecked_count",
  "markdown_audit_excluded_active_spec_count",
  "markdown_audit_complete"
]);
const NUMBER_PROPERTIES = new Set([
  "error_count",
  "warning_count",
  "invalid_input_count",
  "degraded_mode_count",
  "quiet_feedback_suppression_count",
  "post_edit_deferred_check_count",
  "post_edit_deferred_reason_count",
  "row_limit",
  "traversal_depth",
  "source_byte_limit"
]);
const SLUG_PROPERTIES = new Set([
  "surface_name",
  "analysis_validity",
  "verification_status",
  "runtime_state",
  "cache_state",
  "status",
  "post_edit_outcome",
  "boundary_name",
  "error_category"
]);
const SAFE_SLUG = /^[a-z][a-z0-9_.-]{0,79}$/;
const SAFE_BOUNDED_TOKEN = /^[a-z0-9][a-z0-9_.-]{0,79}$/;
const POSTHOG_EXCEPTION_EVENT = "$exception";
const POSTHOG_EXCEPTION_LEVEL = "error";
const GENERIC_EXCEPTION_VALUE = "agent_workbench_runtime_error";
const ERROR_CATEGORIES = new Set([
  "type_error",
  "range_error",
  "syntax_error",
  "reference_error",
  "uri_error",
  "aggregate_error",
  "error",
  "non_error_throwable"
]);

function distributionEnabledFromBuild(): boolean {
  return typeof __AGENT_WORKBENCH_DISTRIBUTION_ANALYTICS_ENABLED__ === "boolean"
    ? __AGENT_WORKBENCH_DISTRIBUTION_ANALYTICS_ENABLED__
    : false;
}

function distributionProjectTokenFromBuild(): string | undefined {
  return typeof __AGENT_WORKBENCH_DISTRIBUTION_POSTHOG_PROJECT_TOKEN__ === "string"
    ? __AGENT_WORKBENCH_DISTRIBUTION_POSTHOG_PROJECT_TOKEN__.trim()
    : undefined;
}

export const DISTRIBUTION_DEFAULT_POSTHOG_ANALYTICS_CONFIG: PostHogDistributionDefaults = (() => {
  const enabled = distributionEnabledFromBuild();
  const projectToken = distributionProjectTokenFromBuild();
  if (!enabled || projectToken === undefined || projectToken === "") {
    return { enabled: false };
  }
  return {
    enabled: true,
    projectToken,
    host: POSTHOG_EU_INGESTION_HOST
  };
})();

export function postHogAnalyticsConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  distributionDefaults: PostHogDistributionDefaults = DISTRIBUTION_DEFAULT_POSTHOG_ANALYTICS_CONFIG
): PostHogAnalyticsConfig {
  const analyticsEnabled = env.AGENT_WORKBENCH_ANALYTICS_ENABLED?.trim().toLowerCase();
  if (analyticsEnabled === "0" || analyticsEnabled === "false") {
    return { enabled: false, status: "disabled" };
  }
  const consent = analyticsEnabled === "1" || analyticsEnabled === "true";
  const useDistributionDefaults = distributionDefaults.enabled && analyticsEnabled === undefined;
  if (!consent && !useDistributionDefaults) {
    return { enabled: false, status: "disabled" };
  }

  const projectToken = env.AGENT_WORKBENCH_POSTHOG_PROJECT_TOKEN?.trim()
    || distributionDefaults.projectToken?.trim();
  const host = env.AGENT_WORKBENCH_POSTHOG_HOST?.trim()
    || distributionDefaults.host?.trim();
  if (projectToken === undefined || projectToken === "" || host === undefined || host === "") {
    return { enabled: false, status: "missing_configuration" };
  }
  if (host !== POSTHOG_EU_INGESTION_HOST) {
    return { enabled: false, status: "invalid_host" };
  }

  return { enabled: true, status: "ready", projectToken, host };
}

export function sanitizePostHogEvent(
  name: string,
  properties: Record<string, unknown> = {}
): SanitizedPostHogEvent | undefined {
  if (!EVENT_NAMES.has(name as SanitizedPostHogEvent["event"])) return undefined;

  const safe: Record<string, SafeScalar> = {};
  if (SURFACE_KINDS.has(String(properties.surface_kind))) {
    safe.surface_kind = String(properties.surface_kind);
  }
  if (BOUNDARY_KINDS.has(String(properties.boundary_kind))) {
    safe.boundary_kind = String(properties.boundary_kind);
  }
  if (OUTCOMES.has(String(properties.outcome))) {
    safe.outcome = String(properties.outcome);
  }

  for (const key of SLUG_PROPERTIES) {
    const value = properties[key];
    if (typeof value === "string" && SAFE_SLUG.test(value)) safe[key] = value;
  }
  for (const key of NUMBER_PROPERTIES) {
    const value = properties[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      safe[key] = Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
    }
  }
  for (const key of BOOLEAN_PROPERTIES) {
    const value = properties[key];
    if (typeof value === "boolean") safe[key] = value;
  }
  for (const [key, value] of Object.entries(properties)) {
    if (
      MARKDOWN_AUDIT_PROPERTIES.has(key) &&
      (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value) && value >= 0))
    ) {
      safe[key] = typeof value === "number" ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER) : value;
    }
  }

  const duration = properties.duration_ms;
  if (typeof duration === "number" && Number.isFinite(duration) && duration >= 0) {
    safe.duration_bucket = durationBucket(duration);
  }
  safe.runtime_version = AGENT_WORKBENCH_RUNTIME_VERSION;

  return { event: name as SanitizedPostHogEvent["event"], properties: safe };
}

export class PostHogTelemetryAdapter implements TelemetryRecorderPort {
  private shutdownPromise: Promise<void> | undefined;

  public constructor(
    private readonly client: PostHogCaptureClient,
    private readonly runtimeId: string,
    private readonly shutdownTimeoutMs = POSTHOG_SHUTDOWN_TIMEOUT_MS
  ) {}

  public record(name: string, properties?: Record<string, unknown>): void {
    const sanitized = sanitizePostHogEvent(name, properties);
    if (sanitized === undefined) return;
    try {
      this.client.capture({
        distinctId: this.runtimeId,
        event: sanitized.event,
        properties: {
          ...sanitized.properties,
          $process_person_profile: false
        },
        disableGeoip: true,
        sendFeatureFlags: false
      });
    } catch {
      // Analytics is observational and cannot affect runtime behavior.
    }
  }

  public recordError(error: unknown, properties?: Record<string, unknown>): void {
    const errorCategory = classifyFailure(error);
    const sanitized = sanitizePostHogEvent("runtime.error", {
      ...properties,
      outcome: "error",
      error_category: errorCategory
    });
    if (sanitized === undefined) return;

    try {
      this.client.captureException(
        buildSyntheticException(errorCategory),
        this.runtimeId,
        {
          ...sanitized.properties,
          $exception_fingerprint: [errorCategory],
          $exception_level: POSTHOG_EXCEPTION_LEVEL,
          $process_person_profile: false
        }
      );
    } catch {
      // Analytics is observational and cannot affect runtime behavior.
    }
  }

  public async flush(): Promise<void> {
    try {
      await this.client.flush();
    } catch {
      // A failed analytics flush is contained at the adapter boundary.
    }
  }

  public shutdown(): Promise<void> {
    this.shutdownPromise ??= this.client.shutdown(this.shutdownTimeoutMs).catch(() => undefined);
    return this.shutdownPromise;
  }
}

export function createPostHogTelemetryAdapter(
  config: PostHogAnalyticsConfig,
  dependencies: {
    runtimeId?: string;
    clientFactory?: PostHogClientFactory;
    shutdownTimeoutMs?: number;
  } = {}
): PostHogTelemetryAdapter | undefined {
  if (!config.enabled || config.status !== "ready" || config.projectToken === undefined || config.host === undefined) {
    return undefined;
  }

  const runtimeId = dependencies.runtimeId ?? crypto.randomUUID();
  const allowedEvents = new Set<SanitizedPostHogEvent["event"]>(EVENT_NAMES.values());
  const clientFactory = dependencies.clientFactory ?? ((projectToken, options) => new PostHog(projectToken, options));
  try {
    const client = clientFactory(config.projectToken, {
      host: config.host,
      enableExceptionAutocapture: false,
      personProfiles: "never",
      before_send: (message) => sanitizeSdkMessage(message, runtimeId, allowedEvents)
    });
    client.on?.("error", () => undefined);
    return new PostHogTelemetryAdapter(
      client,
      runtimeId,
      dependencies.shutdownTimeoutMs ?? POSTHOG_SHUTDOWN_TIMEOUT_MS
    );
  } catch {
    return undefined;
  }
}

function sanitizeSdkMessage(
  message: EventMessage | null,
  runtimeId: string,
  allowedEvents: ReadonlySet<SanitizedPostHogEvent["event"]>
): EventMessage | null {
  if (message === null) return null;
  if (message.event === POSTHOG_EXCEPTION_EVENT) {
    return sanitizeSdkExceptionMessage(message, runtimeId);
  }
  if (!allowedEvents.has(message.event as SanitizedPostHogEvent["event"])) return null;
  const properties: Record<string, SafeScalar> = { $process_person_profile: false };
  for (const [key, value] of Object.entries(message.properties ?? {})) {
    if (key === "surface_kind" && SURFACE_KINDS.has(String(value))) properties[key] = String(value);
    else if (key === "boundary_kind" && BOUNDARY_KINDS.has(String(value))) properties[key] = String(value);
    else if (key === "outcome" && OUTCOMES.has(String(value))) properties[key] = String(value);
    else if ((key === "runtime_version" || key === "duration_bucket") &&
      typeof value === "string" && SAFE_BOUNDED_TOKEN.test(value)) properties[key] = value;
    else if (SLUG_PROPERTIES.has(key) &&
      typeof value === "string" && SAFE_SLUG.test(value)) properties[key] = value;
    else if (NUMBER_PROPERTIES.has(key) && typeof value === "number" && Number.isFinite(value) && value >= 0) {
      properties[key] = Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
    } else if (BOOLEAN_PROPERTIES.has(key) && typeof value === "boolean") properties[key] = value;
    else if (MARKDOWN_AUDIT_PROPERTIES.has(key) &&
      (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value) && value >= 0))) {
      properties[key] = typeof value === "number" ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER) : value;
    }
  }
  return {
    distinctId: runtimeId,
    event: message.event,
    properties,
    disableGeoip: true,
    sendFeatureFlags: false
  };
}

function sanitizeSdkExceptionMessage(
  message: EventMessage,
  runtimeId: string
): EventMessage | null {
  const rawProperties = message.properties ?? {};
  // posthog-node removes its private captureException marker before before_send.
  // Trust only our allowlisted category fingerprint, then rebuild the payload.
  const exceptionType = resolveExceptionCategory(rawProperties);
  if (exceptionType === undefined) return null;

  const properties: Record<string, unknown> = {
    $process_person_profile: false,
    $exception_list: [{
      type: exceptionType,
      value: GENERIC_EXCEPTION_VALUE
    }],
    $exception_fingerprint: [exceptionType],
    $exception_level: POSTHOG_EXCEPTION_LEVEL,
    error_category: exceptionType
  };
  for (const [key, value] of Object.entries(rawProperties)) {
    if (key === "surface_kind" && SURFACE_KINDS.has(String(value))) properties[key] = String(value);
    else if (key === "boundary_kind" && BOUNDARY_KINDS.has(String(value))) properties[key] = String(value);
    else if (key === "outcome" && OUTCOMES.has(String(value))) properties[key] = String(value);
    else if ((key === "runtime_version" || key === "duration_bucket") &&
      typeof value === "string" && SAFE_BOUNDED_TOKEN.test(value)) properties[key] = value;
    else if (key !== "error_category" && SLUG_PROPERTIES.has(key) &&
      typeof value === "string" && SAFE_SLUG.test(value)) properties[key] = value;
    else if (NUMBER_PROPERTIES.has(key) && typeof value === "number" && Number.isFinite(value) && value >= 0) {
      properties[key] = Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
    } else if (BOOLEAN_PROPERTIES.has(key) && typeof value === "boolean") properties[key] = value;
    else if (MARKDOWN_AUDIT_PROPERTIES.has(key) &&
      (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value) && value >= 0))) {
      properties[key] = typeof value === "number" ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER) : value;
    }
  }
  return {
    distinctId: runtimeId,
    event: POSTHOG_EXCEPTION_EVENT,
    properties,
    disableGeoip: true,
    sendFeatureFlags: false
  };
}

function buildSyntheticException(errorCategory: string): Error {
  const error = new Error(GENERIC_EXCEPTION_VALUE);
  error.name = errorCategory;
  delete error.stack;
  return error;
}

function resolveExceptionCategory(properties: Record<string, unknown>): string | undefined {
  const fingerprint = properties.$exception_fingerprint;
  if (Array.isArray(fingerprint) && fingerprint.length > 0) {
    const first = fingerprint[0];
    if (typeof first === "string" && ERROR_CATEGORIES.has(first)) {
      return first;
    }
  }
  return undefined;
}

function durationBucket(durationMs: number): string {
  if (durationMs < 10) return "lt_10ms";
  if (durationMs < 50) return "10_49ms";
  if (durationMs < 250) return "50_249ms";
  if (durationMs < 1_000) return "250_999ms";
  if (durationMs < 5_000) return "1_4s";
  return "gte_5s";
}

function classifyFailure(error: unknown): string {
  if (error instanceof TypeError) return "type_error";
  if (error instanceof RangeError) return "range_error";
  if (error instanceof SyntaxError) return "syntax_error";
  if (error instanceof ReferenceError) return "reference_error";
  if (error instanceof URIError) return "uri_error";
  if (error instanceof AggregateError) return "aggregate_error";
  return error instanceof Error ? "error" : "non_error_throwable";
}
