export function withDefaultRepoRoot<T extends { repo_root?: string }>(
  request: T,
  repoRoot: string
): T & { repo_root: string } {
  return {
    ...request,
    repo_root: request.repo_root ?? repoRoot
  };
}
