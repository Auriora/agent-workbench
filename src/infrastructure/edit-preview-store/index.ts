import type { EditToken } from "../../contracts/index.js";
import type { EditPreviewStorePort } from "../../ports/index.js";

export class InMemoryEditPreviewStoreAdapter implements EditPreviewStorePort {
  private readonly previews = new Map<string, EditToken>();

  public async put(input: { preview: EditToken }): Promise<void> {
    this.previews.set(input.preview.preview_token, input.preview);
  }

  public async get(input: { preview_token: string }): Promise<EditToken | null> {
    return this.previews.get(input.preview_token) ?? null;
  }

  public async consume(input: { preview_token: string }): Promise<EditToken | null> {
    const preview = this.previews.get(input.preview_token) ?? null;
    this.previews.delete(input.preview_token);
    return preview;
  }

  public async delete(input: { preview_token: string }): Promise<void> {
    this.previews.delete(input.preview_token);
  }

  public async purgeExpired(input: { now_iso8601: string }): Promise<number> {
    const now = Date.parse(input.now_iso8601);
    let removed = 0;
    for (const [token, preview] of this.previews) {
      if (Date.parse(preview.expires_at) <= now) {
        this.previews.delete(token);
        removed += 1;
      }
    }
    return removed;
  }
}
