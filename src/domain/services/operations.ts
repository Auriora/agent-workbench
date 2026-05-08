export type WorkPriority = "fast" | "medium" | "slow";

export interface QueueWorkItem<TPayload = unknown> {
  kind: string;
  payload: TPayload;
  queue_name?: string;
  trace_id?: string;
  dedupe_key?: string;
}

export interface QueueHandle {
  queue_id: string;
  priority: WorkPriority;
  enqueued_at: string;
}

export interface CancellationToken {
  token: string;
  reason?: string;
  issued_at: string;
  expires_at?: string;
}
