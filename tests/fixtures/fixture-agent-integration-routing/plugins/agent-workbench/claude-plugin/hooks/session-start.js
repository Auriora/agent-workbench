export function buildClaudeSessionStartContext(payload) {
  return payload?.cwd ?? "";
}
