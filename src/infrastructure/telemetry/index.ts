import { trace, type Tracer } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { TelemetryRecorderPort } from "../../ports/index.js";

export type TelemetryRecord = {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: string;
};

export type TelemetryDestination = "none" | "console" | "otlp_http";

export type TelemetryConfig = {
  enabled: boolean;
  destination: TelemetryDestination;
  serviceName: string;
  endpoint?: string;
};

export type TelemetryAdapter = TelemetryRecorderPort;

export type TelemetryBoundaryKind =
  | "use_case"
  | "graph_query"
  | "worker"
  | "cache"
  | "presentation"
  | "degraded_state"
  | "error_boundary";

export type TelemetryBoundaryInput<T> = {
  telemetry?: TelemetryAdapter;
  boundary: TelemetryBoundaryKind;
  name: string;
  attributes?: Record<string, unknown>;
  run: () => Promise<T> | T;
};

type StartupFailureReason = "startup_failure" | "shutdown_failure";

type OperationalEventInput = {
  event: string;
  destination: TelemetryDestination;
  serviceName: string;
  endpoint?: string;
  outcome: "ok" | "failed";
  reason?: StartupFailureReason;
};

function errorAttributes(error: unknown): {
  error_name: string;
  error_message: string;
} {
  return {
    error_name: error instanceof Error ? error.name : "Error",
    error_message: error instanceof Error ? error.message : String(error)
  };
}

function buildOperationalEvent(input: OperationalEventInput, extra?: Record<string, unknown>): Record<string, unknown> {
  const event = {
    event: input.event,
    destination: input.destination,
    service_name: input.serviceName,
    outcome: input.outcome,
    reason: input.reason
  } satisfies Record<string, unknown>;

  if (input.endpoint !== undefined) {
    return { ...event, endpoint: input.endpoint, ...(extra ?? {}) };
  }

  return { ...event, ...(extra ?? {}) };
}

export class NoopTelemetryAdapter {
  public record(_name: string, _properties?: Record<string, unknown>): void {
    // Telemetry is disabled by default, so the no-op adapter must stay cheap.
  }

  public recordError(_error: unknown, _properties?: Record<string, unknown>): void {
    // Telemetry is disabled by default, so the no-op adapter must stay cheap.
  }

  public flush(): void {
    return undefined;
  }

  public shutdown(): void {
    return undefined;
  }
}

export function createNoopTelemetryAdapter(): NoopTelemetryAdapter {
  return new NoopTelemetryAdapter();
}

export class InMemoryTelemetryAdapter implements TelemetryAdapter {
  public readonly records: TelemetryRecord[] = [];

  public record(name: string, properties?: Record<string, unknown>): void {
    this.records.push({
      name,
      properties,
      timestamp: new Date().toISOString()
    });
  }

  public recordError(error: unknown, properties?: Record<string, unknown>): void {
    this.record("error", {
      ...properties,
      error_name: error instanceof Error ? error.name : "Error",
      error_message: error instanceof Error ? error.message : String(error)
    });
  }

  public flush(): void {
    return undefined;
  }

  public shutdown(): void {
    return undefined;
  }
}

export class OpenTelemetryAdapter implements TelemetryAdapter {
  private readonly provider: NodeTracerProvider;
  private readonly tracer: Tracer;
  private readonly destination: TelemetryDestination;
  private readonly endpoint?: string;
  private readonly serviceName: string;

  constructor(input: {
    provider: NodeTracerProvider;
    tracerName: string;
    destination: TelemetryDestination;
    endpoint?: string;
  }) {
    this.provider = input.provider;
    this.tracer = trace.getTracer(input.tracerName);
    this.destination = input.destination;
    this.endpoint = input.endpoint;
    this.serviceName = input.tracerName;
  }

  public record(name: string, properties?: Record<string, unknown>): void {
    const span = this.tracer.startSpan(name);
    for (const [key, value] of Object.entries(properties ?? {})) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        span.setAttribute(key, value);
      } else if (value != null) {
        span.setAttribute(key, JSON.stringify(value));
      }
    }
    span.end();
  }

  public recordError(error: unknown, properties?: Record<string, unknown>): void {
    const span = this.tracer.startSpan("error");
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    for (const [key, value] of Object.entries(properties ?? {})) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        span.setAttribute(key, value);
      } else if (value != null) {
        span.setAttribute(key, JSON.stringify(value));
      }
    }
    span.end();
  }

  public async flush(): Promise<void> {
    try {
      await this.provider.forceFlush();
      this.record("telemetry.flush", {
        phase: "complete",
        ...buildOperationalEvent({
          event: "telemetry.flush",
          destination: this.destination,
          serviceName: this.serviceName,
          endpoint: this.endpoint,
          outcome: "ok"
        })
      });
    } catch (error) {
      this.recordError(error, {
        phase: "flush",
        ...buildOperationalEvent({
          event: "telemetry.exporter.failure",
          destination: this.destination,
          serviceName: this.serviceName,
          endpoint: this.endpoint,
          outcome: "failed",
          reason: "shutdown_failure"
        }),
        ...errorAttributes(error)
      });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    this.record("telemetry.shutdown", {
      phase: "start",
      ...buildOperationalEvent({
        event: "telemetry.shutdown",
        destination: this.destination,
        serviceName: this.serviceName,
        endpoint: this.endpoint,
        outcome: "ok"
      })
    });

    try {
      await this.provider.shutdown();
      this.record("telemetry.shutdown", {
        phase: "complete",
        ...buildOperationalEvent({
          event: "telemetry.shutdown",
          destination: this.destination,
          serviceName: this.serviceName,
          endpoint: this.endpoint,
          outcome: "ok"
        })
      });
    } catch (error) {
      this.recordError(error, {
        phase: "shutdown",
        ...buildOperationalEvent({
          event: "telemetry.exporter.failure",
          destination: this.destination,
          serviceName: this.serviceName,
          endpoint: this.endpoint,
          outcome: "failed",
          reason: "shutdown_failure"
        }),
        ...errorAttributes(error)
      });
      throw error;
    }
  }
}

export async function runTelemetryBoundary<T>(
  input: TelemetryBoundaryInput<T>
): Promise<T> {
  if (input.telemetry === undefined) {
    return input.run();
  }

  const startedAt = Date.now();
  try {
    const result = await input.run();
    input.telemetry.record("runtime.boundary", {
      boundary_kind: input.boundary,
      boundary_name: input.name,
      outcome: input.boundary === "degraded_state" ? "degraded" : "ok",
      duration_ms: Date.now() - startedAt,
      ...(input.attributes ?? {})
    });
    return result;
  } catch (error) {
    input.telemetry.recordError(error, {
      boundary_kind: input.boundary,
      boundary_name: input.name,
      outcome: "error",
      duration_ms: Date.now() - startedAt,
      ...(input.attributes ?? {})
    });
    throw error;
  }
}

export function telemetryConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TelemetryConfig {
  const enabled = env.AGENT_WORKBENCH_OTEL_ENABLED === "1" || env.AGENT_WORKBENCH_OTEL_ENABLED === "true";
  const destination = parseDestination(env.AGENT_WORKBENCH_OTEL_DESTINATION);
  return {
    enabled,
    destination: enabled ? destination : "none",
    serviceName: env.AGENT_WORKBENCH_OTEL_SERVICE_NAME ?? "agent-workbench",
    endpoint: env.AGENT_WORKBENCH_OTEL_ENDPOINT
  };
}

export function createTelemetryAdapter(config: TelemetryConfig): TelemetryAdapter {
  if (!config.enabled || config.destination === "none") {
    return createNoopTelemetryAdapter();
  }

  try {
    const traceExporter =
      config.destination === "console"
        ? new ConsoleSpanExporter()
        : new OTLPTraceExporter({
            url: config.endpoint ?? "http://localhost:4318/v1/traces"
          });
    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: config.serviceName
      }),
      spanProcessors: [new BatchSpanProcessor(traceExporter)]
    });
    provider.register();

    const adapter = new OpenTelemetryAdapter({
      provider,
      tracerName: config.serviceName,
      destination: config.destination,
      endpoint: config.endpoint
    });

    adapter.record("telemetry.startup", {
      ...buildOperationalEvent({
        event: "telemetry.startup",
        destination: config.destination,
        serviceName: config.serviceName,
        endpoint: config.endpoint,
        outcome: "ok"
      }),
      phase: "start"
    });

    return adapter;
  } catch (error) {
    const fallback = new InMemoryTelemetryAdapter();
    fallback.record("telemetry.exporter.failure", {
      ...buildOperationalEvent({
        event: "telemetry.exporter.failure",
        destination: config.destination,
        serviceName: config.serviceName,
        endpoint: config.endpoint,
        outcome: "failed",
        reason: "startup_failure"
      }),
      phase: "startup",
      ...errorAttributes(error)
    });
    fallback.record("telemetry.startup", {
      ...buildOperationalEvent({
        event: "telemetry.startup",
        destination: config.destination,
        serviceName: config.serviceName,
        endpoint: config.endpoint,
        outcome: "failed",
        reason: "startup_failure"
      }),
      phase: "start"
    });
    return fallback;
  }
}

function parseDestination(value: string | undefined): TelemetryDestination {
  if (value === "console" || value === "otlp_http" || value === "none") {
    return value;
  }
  return "otlp_http";
}
