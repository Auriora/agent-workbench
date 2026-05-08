export type TelemetryRecord = {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: string;
};

export class NoopTelemetryAdapter {
  private readonly records: TelemetryRecord[] = [];

  public record(name: string, properties?: Record<string, unknown>): void {
    this.records.push({
      name,
      properties,
      timestamp: new Date().toISOString()
    });
  }

  public recordError(error: unknown, properties?: Record<string, unknown>): void {
    this.record("error", {
      error: String(error),
      ...properties
    });
  }

  public flush(): TelemetryRecord[] {
    return this.records.splice(0, this.records.length);
  }
}

export function createNoopTelemetryAdapter(): NoopTelemetryAdapter {
  return new NoopTelemetryAdapter();
}
