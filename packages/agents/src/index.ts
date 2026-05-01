import type { AgentKind, AgentMode } from "@noecho/protocol";

export interface AgentAdapterDescriptor {
  kind: AgentKind;
  label: string;
  binary: string;
  modes: AgentMode[];
  goalCapable: boolean;
}

export const agentAdapters: AgentAdapterDescriptor[] = [
  { kind: "codex", label: "Codex", binary: "codex", modes: ["chat", "terminal", "goal"], goalCapable: true },
  { kind: "claude-code", label: "Claude Code", binary: "claude", modes: ["chat", "terminal", "review", "goal"], goalCapable: true },
  { kind: "opencode", label: "OpenCode", binary: "opencode", modes: ["chat", "terminal", "goal"], goalCapable: true },
  { kind: "shell", label: "Shell", binary: "sh", modes: ["terminal"], goalCapable: false }
];
