import type { AgentKind, RiskLevel } from "@noecho/protocol";

export interface PromptMacro {
  id: string;
  title: string;
  voicePhrases: string[];
  targetAgents: AgentKind[];
  risk: RiskLevel;
  template: string;
}

export const starterMacros: PromptMacro[] = [
  {
    id: "fix-build",
    title: "fix build",
    voicePhrases: ["fix build", "fix the build"],
    targetAgents: ["codex", "claude-code", "opencode"],
    risk: "file-edit",
    template: "Inspect the build failure, make the smallest correct fix, and rerun the failing command."
  },
  {
    id: "audit-contract",
    title: "audit contract",
    voicePhrases: ["audit contract", "check solidity"],
    targetAgents: ["codex", "claude-code"],
    risk: "shell",
    template: "Run the local smart-contract test and audit toolchain, summarize findings, and ask before edits."
  },
  {
    id: "ship-preview",
    title: "ship preview",
    voicePhrases: ["ship preview", "deploy preview"],
    targetAgents: ["codex", "claude-code", "shell"],
    risk: "deploy",
    template: "Prepare a deploy preview, verify build logs, and request approval before publishing."
  }
];
