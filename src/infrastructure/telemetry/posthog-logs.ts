/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SeverityNumber, type LogRecord, type Logger } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import type { TelemetryRecorderPort } from "../../ports/index.js";
import { AGENT_WORKBENCH_RUNTIME_VERSION } from "../../runtime/version.js";
import {
  sanitizePostHogEvent,
  type PostHogAnalyticsConfig,
  type SanitizedPostHogEvent
} from "./posthog.js";

export const POSTHOG_EU_LOGS_ENDPOINT = "https://eu.i.posthog.com/i/v1/logs";
const POSTHOG_LOGS_EXPORT_TIMEOUT_MS = 1_000;
const POSTHOG_LOGS_SERVICE_NAME = "agent-workbench";

type PostHogLogsConfigurationStatus =
  | "disabled"
  | "ready"
  | "missing_configuration"
  | "invalid_host";

export type PostHogLogsConfig = {
  enabled: boolean;
  status: PostHogLogsConfigurationStatus;
  projectToken?: string;
  endpoint?: string;
  serviceName: string;
};

export type PostHogLogProvider = {
  getLogger(name: string, version?: string): Logger;
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
};

export type PostHogLogProviderFactory = (input: {
  projectToken: string;
  endpoint: string;
  serviceName: string;
}) => PostHogLogProvider;

type OperationalLog = {
  body: string;
  severityNumber: SeverityNumber.WARN | SeverityNumber.ERROR;
  severityText: "WARN" | "ERROR";
  attributes: SanitizedPostHogEvent["properties"];
};

const LOG_BODIES = {
  "mcp.tool.dispatch": "agent_workbench.mcp_tool_attention",
  "mcp.resource.dispatch": "agent_workbench.mcp_resource_attention",
  "runtime.boundary": "agent_workbench.runtime_boundary_attention"
} as const;

export function postHogLogsConfigFromEnv(
  env: NodeJS.ProcessEnv,
  analyticsConfig: PostHogAnalyticsConfig
): PostHogLogsConfig {
  const serviceName = POSTHOG_LOGS_SERVICE_NAME;
  const logsEnabled = env.AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED?.trim().toLowerCase();
  const analyticsEnabled = env.AGENT_WORKBENCH_ANALYTICS_ENABLED?.trim().toLowerCase();
  if (
    (logsEnabled !== "true" && logsEnabled !== "1") ||
    analyticsEnabled === "false" ||
    analyticsEnabled === "0"
  ) {
    return { enabled: false, status: "disabled", serviceName };
  }
  if (analyticsConfig.status === "invalid_host") {
    return { enabled: false, status: "invalid_host", serviceName };
  }
  if (
    !analyticsConfig.enabled ||
    analyticsConfig.status !== "ready" ||
    analyticsConfig.projectToken === undefined
  ) {
    return { enabled: false, status: "missing_configuration", serviceName };
  }
  return {
    enabled: true,
    status: "ready",
    projectToken: analyticsConfig.projectToken,
    endpoint: POSTHOG_EU_LOGS_ENDPOINT,
    serviceName
  };
}

export class PostHogLogsTelemetryAdapter implements TelemetryRecorderPort {
  private readonly logger: Logger;
  private shutdownPromise: Promise<void> | undefined;

  public constructor(private readonly provider: PostHogLogProvider, serviceName: string) {
    this.logger = provider.getLogger(serviceName, AGENT_WORKBENCH_RUNTIME_VERSION);
  }

  public record(name: string, properties?: Record<string, unknown>): void {
    const log = sanitizeOperationalLog(name, properties);
    if (log === undefined) return;
    try {
      this.logger.emit({
        eventName: log.body,
        body: log.body,
        severityNumber: log.severityNumber,
        severityText: log.severityText,
        attributes: log.attributes
      } satisfies LogRecord);
    } catch {
      // Operational logging is observational and cannot affect runtime behavior.
    }
  }

  public recordError(_error: unknown, _properties?: Record<string, unknown>): void {
    // Sanitized PostHog Error Tracking is the sole exception destination.
  }

  public async flush(): Promise<void> {
    try {
      await this.provider.forceFlush();
    } catch {
      // A failed logs flush is contained at the adapter boundary.
    }
  }

  public shutdown(): Promise<void> {
    this.shutdownPromise ??= this.provider.shutdown().catch(() => undefined);
    return this.shutdownPromise;
  }
}

export function createPostHogLogsTelemetryAdapter(
  config: PostHogLogsConfig,
  dependencies: { providerFactory?: PostHogLogProviderFactory } = {}
): PostHogLogsTelemetryAdapter | undefined {
  if (
    !config.enabled || config.status !== "ready" ||
    config.projectToken === undefined || config.endpoint === undefined
  ) {
    return undefined;
  }
  try {
    const provider = (dependencies.providerFactory ?? createDefaultProvider)({
      projectToken: config.projectToken,
      endpoint: config.endpoint,
      serviceName: config.serviceName
    });
    return new PostHogLogsTelemetryAdapter(provider, config.serviceName);
  } catch {
    return undefined;
  }
}

export function sanitizeOperationalLog(
  name: string,
  properties: Record<string, unknown> = {}
): OperationalLog | undefined {
  if (!Object.hasOwn(LOG_BODIES, name)) return undefined;
  const sanitized = sanitizePostHogEvent(name, properties);
  if (sanitized === undefined || sanitized.event === "runtime.error") return undefined;

  const outcome = sanitized.properties.outcome;
  const errorOutcome = outcome === "error" || outcome === "failed";
  const warningOutcome = outcome === "blocked" || outcome === "degraded" || outcome === "missing";
  const degradedCount = sanitized.properties.degraded_mode_count;
  if (
    !errorOutcome && !warningOutcome &&
    !(typeof degradedCount === "number" && degradedCount > 0)
  ) return undefined;

  const body = LOG_BODIES[sanitized.event as keyof typeof LOG_BODIES];
  if (body === undefined) return undefined;
  return {
    body,
    severityNumber: errorOutcome ? SeverityNumber.ERROR : SeverityNumber.WARN,
    severityText: errorOutcome ? "ERROR" : "WARN",
    attributes: sanitized.properties
  };
}

function createDefaultProvider(input: {
  projectToken: string;
  endpoint: string;
  serviceName: string;
}): LoggerProvider {
  const exporter = new OTLPLogExporter({
    url: input.endpoint,
    headers: { Authorization: `Bearer ${input.projectToken}` },
    timeoutMillis: POSTHOG_LOGS_EXPORT_TIMEOUT_MS
  });
  return new LoggerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: input.serviceName,
      [ATTR_SERVICE_VERSION]: AGENT_WORKBENCH_RUNTIME_VERSION
    }),
    forceFlushTimeoutMillis: POSTHOG_LOGS_EXPORT_TIMEOUT_MS,
    logRecordLimits: {
      attributeCountLimit: 32,
      attributeValueLengthLimit: 80
    },
    processors: [new BatchLogRecordProcessor(exporter, {
      exportTimeoutMillis: POSTHOG_LOGS_EXPORT_TIMEOUT_MS
    })]
  });
}
