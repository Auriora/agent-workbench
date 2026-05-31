import { trace, type Tracer } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

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

export type TelemetryAdapter = {
  record(name: string, properties?: Record<string, unknown>): void;
  recordError(error: unknown, properties?: Record<string, unknown>): void;
  flush(): Promise<void> | void;
  shutdown(): Promise<void> | void;
};

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

  constructor(input: {
    provider: NodeTracerProvider;
    tracerName: string;
  }) {
    this.provider = input.provider;
    this.tracer = trace.getTracer(input.tracerName);
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
    await this.provider.forceFlush();
  }

  public async shutdown(): Promise<void> {
    await this.provider.shutdown();
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

  return new OpenTelemetryAdapter({
    provider,
    tracerName: config.serviceName
  });
}

function parseDestination(value: string | undefined): TelemetryDestination {
  if (value === "console" || value === "otlp_http" || value === "none") {
    return value;
  }
  return "otlp_http";
}
