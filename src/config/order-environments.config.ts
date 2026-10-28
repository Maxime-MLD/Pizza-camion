/** Deployment identities only; no credentials. Test traffic must never target Production. */
export const orderEnvironments = {
  productionSupabaseRef: 'fqjkkjvrklpzhwmswlsy',
  testSupabaseRef: 'brzcvncsycdpsrvulqss',
  testBranch: 'codex/test-commandes',
} as const;
