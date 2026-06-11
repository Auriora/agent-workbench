import { register } from "tsx/esm/api";

register({ parentURL: import.meta.url });
await import("./stdio.ts");
