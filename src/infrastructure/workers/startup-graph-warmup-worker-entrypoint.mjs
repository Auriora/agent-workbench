import { register } from "tsx/esm/api";

register({ parentURL: import.meta.url });
await import("./startup-graph-warmup-worker.ts");
