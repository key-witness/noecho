import { z } from "zod";

export const agentKinds = ["claude-code", "codex", "opencode", "shell"] as const;
export const agentModes = ["chat", "terminal", "review", "goal"] as const;
export const agentStatuses = ["idle", "running", "blocked", "approving", "failed", "done"] as const;
export const riskLevels = ["safe", "file-edit", "shell", "deploy", "payment", "signing"] as const;
export const machineStatuses = ["pairing", "online", "offline", "revoked"] as const;
export const eventKinds = ["heard", "planned", "edited", "tested", "blocked", "ready", "log"] as const;
export const walletChains = ["eip155", "solana"] as const;
export const mppIntents = ["charge", "session"] as const;
export const mppMethods = ["tempo", "stripe", "manual"] as const;

export const WalletIdentitySchema = z.object({
  id: z.string().min(1),
  chain: z.enum(walletChains),
  address: z.string().min(1),
  createdAt: z.string().datetime()
});

export const MachineSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  name: z.string().min(1),
  publicKey: z.string().min(1),
  status: z.enum(machineStatuses),
  createdAt: z.string().datetime()
});

export const PairingCodeSchema = z.object({
  code: z.string().min(4),
  profileId: z.string().min(1),
  machineName: z.string().min(1),
  pairingUrl: z.string().min(1),
  command: z.string().min(1),
  status: z.enum(machineStatuses),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime()
});

export const AgentTabSchema = z.object({
  id: z.string().min(1),
  machineId: z.string().min(1),
  agent: z.enum(agentKinds),
  mode: z.enum(agentModes),
  repo: z.string().min(1),
  worktree: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  status: z.enum(agentStatuses),
  risk: z.enum(riskLevels),
  spendUsd: z.number().min(0)
});

export const AgentEventSchema = z.object({
  id: z.string().min(1),
  tabId: z.string().min(1),
  kind: z.enum(eventKinds),
  message: z.string().min(1),
  createdAt: z.string().datetime()
});

export const TerminalChunkSchema = z.object({
  id: z.string().min(1),
  tabId: z.string().min(1),
  stream: z.enum(["stdout", "stderr", "meta"]),
  chunk: z.string(),
  createdAt: z.string().datetime()
});

export const CommandRequestSchema = z.object({
  tabId: z.string().min(1),
  command: z.string().min(1),
  risk: z.enum(riskLevels).default("safe"),
  requireApproval: z.boolean().default(false)
});

export const ApprovalRequestSchema = z.object({
  id: z.string().min(1),
  tabId: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  risk: z.enum(riskLevels),
  amountUsd: z.number().min(0),
  createdAt: z.string().datetime()
});

export const PromptMacroSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  voicePhrases: z.array(z.string().min(1)).min(1),
  targetAgents: z.array(z.enum(agentKinds)).min(1),
  risk: z.enum(riskLevels),
  template: z.string().min(1),
  mppPriceUsd: z.number().min(0).optional()
});

export const GoalRunSchema = z.object({
  id: z.string().min(1),
  tabId: z.string().min(1),
  prompt: z.string().min(1),
  runtimeBudgetMinutes: z.number().int().positive(),
  spendBudgetUsd: z.number().min(0),
  checkpointIntervalMinutes: z.number().int().positive(),
  status: z.enum(agentStatuses)
});

export const GoalCheckpointSchema = z.object({
  id: z.string().min(1),
  goalRunId: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  createdAt: z.string().datetime()
});

export const SpendLimitSchema = z.object({
  profileId: z.string().min(1),
  hourlyUsd: z.number().min(0),
  goalUsd: z.number().min(0),
  actionUsd: z.number().min(0),
  requireApprovalAboveUsd: z.number().min(0)
});

export const MppReceiptSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  action: z.string().min(1),
  amountUsd: z.number().min(0),
  provider: z.string().min(1),
  receipt: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime()
});

export const MppOfferSchema = z.object({
  amount: z.string().min(1),
  currency: z.string().min(1),
  intent: z.enum(mppIntents),
  method: z.enum(mppMethods)
});

export type AgentKind = z.infer<typeof AgentTabSchema>["agent"];
export type AgentMode = z.infer<typeof AgentTabSchema>["mode"];
export type AgentStatus = z.infer<typeof AgentTabSchema>["status"];
export type RiskLevel = z.infer<typeof AgentTabSchema>["risk"];

export type WalletIdentity = z.infer<typeof WalletIdentitySchema>;
export type Machine = z.infer<typeof MachineSchema>;
export type PairingCode = z.infer<typeof PairingCodeSchema>;
export type AgentTab = z.infer<typeof AgentTabSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type TerminalChunk = z.infer<typeof TerminalChunkSchema>;
export type CommandRequest = z.infer<typeof CommandRequestSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type PromptMacro = z.infer<typeof PromptMacroSchema>;
export type GoalRun = z.infer<typeof GoalRunSchema>;
export type GoalCheckpoint = z.infer<typeof GoalCheckpointSchema>;
export type SpendLimit = z.infer<typeof SpendLimitSchema>;
export type MppReceipt = z.infer<typeof MppReceiptSchema>;
export type MppOffer = z.infer<typeof MppOfferSchema>;

export const parseWalletIdentity = (input: unknown) => WalletIdentitySchema.parse(input);
export const parseMachine = (input: unknown) => MachineSchema.parse(input);
export const parsePairingCode = (input: unknown) => PairingCodeSchema.parse(input);
export const parseAgentTab = (input: unknown) => AgentTabSchema.parse(input);
export const parseAgentEvent = (input: unknown) => AgentEventSchema.parse(input);
export const parseTerminalChunk = (input: unknown) => TerminalChunkSchema.parse(input);
export const parseCommandRequest = (input: unknown) => CommandRequestSchema.parse(input);
export const parseApprovalRequest = (input: unknown) => ApprovalRequestSchema.parse(input);
export const parsePromptMacro = (input: unknown) => PromptMacroSchema.parse(input);
export const parseGoalRun = (input: unknown) => GoalRunSchema.parse(input);
export const parseGoalCheckpoint = (input: unknown) => GoalCheckpointSchema.parse(input);
export const parseSpendLimit = (input: unknown) => SpendLimitSchema.parse(input);
export const parseMppReceipt = (input: unknown) => MppReceiptSchema.parse(input);
export const parseMppOffer = (input: unknown) => MppOfferSchema.parse(input);

export function createProtocolFixtures() {
  const now = new Date().toISOString();

  return {
    walletIdentity: {
      id: "wallet_01",
      chain: "eip155",
      address: "0x8f2c8d7e7d0d8f2c8d7e7d0d8f2c8d7e7d0d8f2c",
      createdAt: now
    },
    machine: {
      id: "machine_01",
      ownerId: "profile_01",
      name: "vps-helix",
      publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINoecho",
      status: "online",
      createdAt: now
    },
    pairingCode: {
      code: "A1B2C3D4",
      profileId: "profile_01",
      machineName: "vps-helix",
      pairingUrl: "noecho://pair?code=A1B2C3D4",
      command: "noecho pair A1B2C3D4",
      status: "pairing",
      createdAt: now,
      expiresAt: now
    },
    agentTab: {
      id: "tab_01",
      machineId: "machine_01",
      agent: "codex",
      mode: "goal",
      repo: "mip/noecho",
      branch: "main",
      status: "running",
      risk: "file-edit",
      spendUsd: 2.18
    },
    agentEvent: {
      id: "event_01",
      tabId: "tab_01",
      kind: "heard",
      message: "make the app shippable",
      createdAt: now
    },
    goalRun: {
      id: "goal_01",
      tabId: "tab_01",
      prompt: "make the app shippable",
      runtimeBudgetMinutes: 540,
      spendBudgetUsd: 15,
      checkpointIntervalMinutes: 30,
      status: "running"
    },
    promptMacro: {
      id: "macro_fix_build",
      title: "fix build",
      voicePhrases: ["fix build", "fix the build"],
      targetAgents: ["codex", "claude-code"],
      risk: "file-edit",
      template: "Inspect the build failure, make the smallest fix, and rerun the command."
    }
  } satisfies {
    walletIdentity: WalletIdentity;
    machine: Machine;
    pairingCode: PairingCode;
    agentTab: AgentTab;
    agentEvent: AgentEvent;
    goalRun: GoalRun;
    promptMacro: PromptMacro;
  };
}
