export type MarkdownLink = {
  label: string;
  target: string;
};

const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

export function extractMarkdownLinks(source: string): MarkdownLink[] {
  return Array.from(source.matchAll(markdownLinkPattern), (match) => ({
    label: match[1],
    target: match[2]
  }));
}
