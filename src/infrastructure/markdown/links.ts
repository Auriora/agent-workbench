export type MarkdownLink = {
  label: string;
  target: string;
};

const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

export class MarkdownLinkExtractorAdapter {
  public extractMarkdownLinks(source: string): MarkdownLink[] {
    return extractMarkdownLinks(source);
  }

  public extractTargets(source: string): string[] {
    return this.extractMarkdownLinks(source).map((link) => link.target);
  }
}

export function extractMarkdownLinks(source: string): MarkdownLink[] {
  return Array.from(source.matchAll(markdownLinkPattern), (match) => ({
    label: match[1],
    target: match[2]
  }));
}
