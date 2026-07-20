export function buildSessionStartContext(payload) {
  return payload?.cwd ?? "";
}
