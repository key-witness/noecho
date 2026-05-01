export type AgentKind = "claude-code" | "codex" | "opencode" | "shell";
export type AgentMode = "chat" | "terminal" | "review" | "goal";
export type AgentStatus = "idle" | "running" | "blocked" | "approving" | "failed" | "done";
export type RiskLevel = "safe" | "file-edit" | "shell" | "deploy" | "payment" | "signing";

export interface WalletIdentity {
  id: string;
  chain: "eip155" | "solana";
  address: string;
  createdAt: string;
}

export interface Machine {
  id: string;
  ownerId: string;
  name: string;
  publicKey: string;
  status: "pairing" | "online" | "offline" | "revoked";
  createdAt: string;
}

export interface AgentTab {
  id: string;
  machineId: string;
  agent: AgentKind;
  mode: AgentMode;
  repo: string;
  worktree?: string;
  branch?: string;
  status: AgentStatus;
  risk: RiskLevel;
  spendUsd: number;
}

export interface AgentEvent {
  id: string;
  tabId: string;
  kind: "heard" | "planned" | "edited" | "tested" | "blocked" | "ready" | "log";
  message: string;
  createdAt: string;
}

export interface GoalRun {
  id: string;
  tabId: string;
  prompt: string;
  runtimeBudgetMinutes: number;
  spendBudgetUsd: number;
  checkpointIntervalMinutes: number;
  status: AgentStatus;
}
