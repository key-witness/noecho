export const tables = [
  "profiles",
  "wallet_identities",
  "machines",
  "repo_connections",
  "agent_sessions",
  "agent_tabs",
  "agent_events",
  "terminal_chunks",
  "approval_requests",
  "prompt_macros",
  "goal_runs",
  "goal_checkpoints",
  "spend_limits",
  "mpp_receipts",
  "donations"
] as const;

export type NoechoTable = (typeof tables)[number];
