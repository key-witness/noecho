import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifyMessage } from "viem";
import { createStateStore } from "./supabase-state.mjs";

const port = Number(process.env.PORT || 4010);
const host = process.env.HOST || process.env.NOECHO_HOST || "127.0.0.1";
const origin = process.env.NOECHO_WEB_ORIGIN || "http://127.0.0.1:3002";
const publicBaseUrl = process.env.NOECHO_PUBLIC_BASE_URL || `http://127.0.0.1:${port}`;
const stateDir = join(process.cwd(), ".noecho");
const statePath = join(stateDir, "server-state.json");
const stateStore = createStateStore();
const mppEnabled = process.env.NOECHO_MPP_ENABLED === "true";
const allowDemoSessions = process.env.NOECHO_ALLOW_DEMO_SESSIONS !== "false";
const daemonAuthRequired = process.env.NOECHO_DAEMON_AUTH_REQUIRED === "true";
const nonces = new Map();
const sessions = new Map();
const pairingCodes = new Map();
const machines = new Map();
const tabs = new Map([
  ["codex-goal", {
    id: "codex-goal",
    machineId: "machine_demo_vps",
    agent: "codex",
    mode: "goal",
    repo: "mip/noecho",
    branch: "main",
    machine: "vps-helix",
    status: "running",
    risk: "file-edit",
    spendUsd: 2.18,
    runtime: "3h 12m / 9h",
    summary: "hardening pairing flow and worker checkpoints"
  }],
  ["claude-review", {
    id: "claude-review",
    machineId: "machine_demo_macbook",
    agent: "claude",
    mode: "review",
    repo: "mip/noecho",
    branch: "ui-step2",
    machine: "macbook",
    status: "approving",
    risk: "push",
    spendUsd: 0.42,
    runtime: "18m",
    summary: "review found 2 warnings in websocket retry logic"
  }],
  ["opencode-audit", {
    id: "opencode-audit",
    machineId: "machine_demo_vps",
    agent: "opencode",
    mode: "audit",
    repo: "contracts/vault",
    branch: "audit/prelaunch",
    machine: "vps-helix",
    status: "blocked",
    risk: "shell",
    spendUsd: 0.76,
    runtime: "41m",
    summary: "waiting for slither install approval"
  }],
  ["shell-local", {
    id: "shell-local",
    machineId: "machine_demo_macbook",
    agent: "shell",
    mode: "terminal",
    repo: "local/noecho",
    branch: "main",
    machine: "macbook",
    status: "idle",
    risk: "safe",
    spendUsd: 0,
    runtime: "ready",
    summary: "paired and ready for manual commands"
  }]
]);
const terminalChunks = new Map([
  ["codex-goal", [
    { id: "chunk_01", tabId: "codex-goal", stream: "meta", chunk: "$ noecho goal start \"make mobile cockpit production ready\" --runtime 9h --budget 15", createdAt: new Date().toISOString() },
    { id: "chunk_02", tabId: "codex-goal", stream: "stdout", chunk: "wallet verified 0x8f2c...91b4 · mpp session open", createdAt: new Date().toISOString() }
  ]]
]);
const approvalRequests = new Map([
  ["approval_slither", {
    id: "approval_slither",
    tabId: "opencode-audit",
    title: "Install Slither on vps-helix",
    detail: "opencode wants to run pipx install slither-analyzer for smart-contract audit tooling.",
    risk: "shell",
    amountUsd: 0,
    createdAt: new Date().toISOString(),
    status: "pending"
  }]
]);
const commandDispatches = new Map();
const goalRuns = new Map();
const goalCheckpoints = new Map();
const rooms = new Map();
const roomParticipants = new Map();
const roomMessages = new Map();
const roomWorkItems = new Map();
let activeProfileId = null;
const paidActions = [
  {
    id: "prompt-pack-vibe",
    title: "Vibe Dev Prompt Pack",
    path: "/paid/prompt-pack/vibe",
    amount: "0.99",
    currency: "usd",
    intent: "charge",
    method: "tempo"
  },
  {
    id: "goal-session",
    title: "Hosted Codex Goal Session",
    path: "/paid/goal-session",
    amount: "15.00",
    currency: "usd",
    intent: "session",
    method: "tempo"
  },
  {
    id: "contract-audit-scan",
    title: "Contract Audit Scan",
    path: "/paid/contract-audit",
    amount: "1.20",
    currency: "usd",
    intent: "charge",
    method: "tempo"
  }
];

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization,content-type,x-mpp-receipt,x-noecho-machine-token",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function paymentInfoFor(action) {
  return {
    offers: [
      {
        amount: action.amount,
        currency: action.currency,
        intent: action.intent,
        method: action.method
      }
    ]
  };
}

function sendPaymentRequired(res, action) {
  sendJson(res, 402, {
    ok: false,
    error: "payment required",
    action: action.id,
    title: action.title,
    payment: paymentInfoFor(action)
  });
}

function getRequestSessionToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const headerToken = req.headers["x-noecho-session-token"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }

  return null;
}

function getPersistedSessionForRequest(req) {
  const token = getRequestSessionToken(req);
  if (!token) return null;
  return sessions.get(token) || null;
}

function getAuthorizedSession(req) {
  const token = getRequestSessionToken(req);
  if (!token) return null;

  const session = sessions.get(token);
  if (session) return session;

  if (allowDemoSessions && token.startsWith("demo_")) {
    return {
      sessionToken: token,
      profileId: "profile_demo",
      address: "",
      createdAt: new Date().toISOString(),
      demo: true
    };
  }

  return null;
}

function requireSession(req, res, { allowDemo = true } = {}) {
  const session = getAuthorizedSession(req);
  if (!session) {
    sendJson(res, 401, { ok: false, error: "session required" });
    return null;
  }

  if (!allowDemo && session.demo) {
    sendJson(res, 401, { ok: false, error: "demo session not allowed" });
    return null;
  }

  return session;
}

function getRequestMachineToken(req) {
  const headerToken = req.headers["x-noecho-machine-token"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer machine_")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

function getAuthorizedMachine(req) {
  const token = getRequestMachineToken(req);
  if (!token) return null;
  return [...machines.values()].find((machine) => machine.machineToken === token) || null;
}

function requireMachine(req, res) {
  const machine = getAuthorizedMachine(req);
  if (machine) return machine;

  if (!daemonAuthRequired) {
    return {
      id: "machine_dev",
      ownerId: activeProfileId || "profile_demo",
      name: "local-daemon",
      status: "online",
      dev: true
    };
  }

  sendJson(res, 401, { ok: false, error: "machine token required" });
  return null;
}

function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Noecho Paid Actions",
      version: "0.0.0"
    },
    servers: [{ url: publicBaseUrl }],
    paths: Object.fromEntries(
      paidActions.map((action) => [
        action.path,
        {
          post: {
            operationId: action.id,
            summary: action.title,
            "x-payment-info": paymentInfoFor(action),
            responses: {
              200: { description: "Paid action accepted" },
              402: { description: "Payment required" }
            }
          }
        }
      ])
    )
  };
}

function createPairing(input = {}) {
  const code = randomUUID().split("-")[0].toUpperCase();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const pairing = {
    code,
    profileId: input.profileId || "profile_demo",
    machineName: input.machineName || "vps-helix",
    pairingUrl: `noecho://pair?code=${code}`,
    command: `noecho pair ${code} --server ${publicBaseUrl}`,
    status: "pairing",
    createdAt: now,
    expiresAt
  };

  pairingCodes.set(code, pairing);
  persistServerState();
  return pairing;
}

function createApproval(input = {}) {
  const approval = {
    id: input.id || `approval_${randomUUID().split("-")[0]}`,
    tabId: input.tabId || "codex-goal",
    roomId: input.roomId ? String(input.roomId) : "",
    messageId: input.messageId ? String(input.messageId) : "",
    title: String(input.title || "Approval required"),
    detail: String(input.detail || "Agent action requires approval."),
    risk: String(input.risk || "safe"),
    amountUsd: Number(input.amountUsd || 0),
    createdAt: input.createdAt || new Date().toISOString(),
    status: String(input.status || "pending")
  };
  approvalRequests.set(approval.id, approval);
  persistServerState();
  return approval;
}

function participantsForRoom(roomId) {
  return roomParticipants.get(roomId) || [];
}

function messagesForRoom(roomId) {
  return roomMessages.get(roomId) || [];
}

function workForRoom(roomId) {
  return roomWorkItems.get(roomId) || [];
}

function createRoom(input = {}) {
  const now = new Date().toISOString();
  const room = {
    id: input.id || `room_${randomUUID().split("-")[0]}`,
    profileId: input.profileId || activeProfileId || "profile_demo",
    title: String(input.title || "Noecho model room"),
    goalRunId: input.goalRunId ? String(input.goalRunId) : "",
    status: "active",
    createdAt: now,
    updatedAt: now
  };
  rooms.set(room.id, room);

  const participants = [
    {
      id: `participant_user_${randomUUID().split("-")[0]}`,
      roomId: room.id,
      kind: "user",
      label: "You",
      agent: "user",
      status: "online",
      createdAt: now
    }
  ];
  for (const agent of Array.isArray(input.agents) && input.agents.length ? input.agents : ["codex", "claude"]) {
    participants.push({
      id: `participant_${agent}_${randomUUID().split("-")[0]}`,
      roomId: room.id,
      kind: "agent",
      label: String(agent),
      agent: String(agent),
      status: "idle",
      createdAt: now
    });
  }
  roomParticipants.set(room.id, participants);
  roomMessages.set(room.id, [
    {
      id: `message_${randomUUID().split("-")[0]}`,
      roomId: room.id,
      authorKind: "system",
      authorLabel: "Noecho",
      body: "Room ready. User messages are highest priority; agent actions require approval.",
      priority: "normal",
      createdAt: now
    }
  ]);
  roomWorkItems.set(room.id, []);
  persistServerState();
  return room;
}

function addRoomParticipant(roomId, input = {}) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("room not found");
  const agent = String(input.agent || "codex").toLowerCase();
  const participant = {
    id: input.id || `participant_${agent}_${randomUUID().split("-")[0]}`,
    roomId,
    kind: agent === "user" ? "user" : "agent",
    label: String(input.label || agent),
    agent,
    status: "idle",
    createdAt: new Date().toISOString()
  };
  const participants = participantsForRoom(roomId);
  participants.push(participant);
  roomParticipants.set(roomId, participants);
  rooms.set(roomId, { ...room, updatedAt: new Date().toISOString() });
  persistServerState();
  return participant;
}

function removeRoomParticipant(roomId, participantId) {
  const participants = participantsForRoom(roomId);
  roomParticipants.set(roomId, participants.filter((participant) => participant.id !== participantId));
  persistServerState();
}

function enqueueRoomWork(roomId, message, targetAgents = []) {
  const participants = participantsForRoom(roomId).filter((participant) => {
    if (participant.kind !== "agent") return false;
    return !targetAgents.length || targetAgents.includes(participant.agent);
  });
  const existing = workForRoom(roomId);
  const created = participants.map((participant) => ({
    id: `work_${randomUUID().split("-")[0]}`,
    roomId,
    messageId: message.id,
    participantId: participant.id,
    agent: participant.agent,
    prompt: message.body,
    priority: message.authorKind === "user" ? "high" : "normal",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  roomWorkItems.set(roomId, [...existing, ...created]);
  return created;
}

function appendRoomMessage(roomId, input = {}) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("room not found");
  const message = {
    id: input.id || `message_${randomUUID().split("-")[0]}`,
    roomId,
    workId: input.workId ? String(input.workId) : "",
    authorKind: String(input.authorKind || "user"),
    authorLabel: String(input.authorLabel || "You"),
    agent: input.agent ? String(input.agent) : "",
    body: String(input.body || "").trim(),
    priority: input.priority || (input.authorKind === "agent" ? "normal" : "high"),
    createdAt: input.createdAt || new Date().toISOString()
  };
  if (!message.body) throw new Error("message body is required");
  const messages = messagesForRoom(roomId);
  messages.push(message);
  roomMessages.set(roomId, messages.slice(-200));
  rooms.set(roomId, { ...room, updatedAt: message.createdAt });

  if (message.authorKind === "user") {
    enqueueRoomWork(roomId, message, Array.isArray(input.targetAgents) ? input.targetAgents : []);
  }

  persistServerState();
  return message;
}

function claimNextRoomWork(roomId, input = {}) {
  const agents = Array.isArray(input.agents) && input.agents.length
    ? input.agents.map((agent) => String(agent).toLowerCase())
    : ["codex", "claude"];
  const items = workForRoom(roomId);
  const next = items
    .filter((item) => item.status === "pending" && agents.includes(item.agent))
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority === "high" ? -1 : 1;
      return Date.parse(left.createdAt) - Date.parse(right.createdAt);
    })[0];
  if (!next) return null;
  const claimed = {
    ...next,
    status: "claimed",
    claimedBy: String(input.executor || "local-daemon"),
    claimedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  roomWorkItems.set(roomId, items.map((item) => item.id === claimed.id ? claimed : item));
  persistServerState();
  return claimed;
}

function completeRoomWork(workId, input = {}) {
  for (const [roomId, items] of roomWorkItems) {
    const found = items.find((item) => item.id === workId);
    if (!found) continue;
    const completed = {
      ...found,
      status: input.status || "completed",
      updatedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    };
    roomWorkItems.set(roomId, items.map((item) => item.id === workId ? completed : item));
    const message = input.body ? appendRoomMessage(roomId, {
      workId,
      authorKind: "agent",
      authorLabel: input.authorLabel || found.agent,
      agent: found.agent,
      body: input.body,
      priority: "normal"
    }) : null;
    if (input.proposedAction) {
      createApproval({
        roomId,
        messageId: message?.id || found.messageId,
        tabId: input.tabId || `${found.agent}-room`,
        title: input.proposedAction.title || `${found.agent} action requires approval`,
        detail: input.proposedAction.detail || found.prompt,
        risk: input.proposedAction.risk || "file-edit",
        amountUsd: input.proposedAction.amountUsd || 0
      });
    }
    persistServerState();
    return completed;
  }
  return null;
}

function appendTerminalChunk(input = {}) {
  const chunk = {
    id: input.id || `chunk_${randomUUID().split("-")[0]}`,
    tabId: input.tabId || "codex-goal",
    stream: input.stream || "stdout",
    chunk: String(input.chunk || ""),
    createdAt: input.createdAt || new Date().toISOString()
  };
  const items = terminalChunks.get(chunk.tabId) || [];
  items.push(chunk);
  terminalChunks.set(chunk.tabId, items.slice(-120));
  persistServerState();
  return chunk;
}

function commandsForTab(tabId) {
  return [...commandDispatches.values()]
    .filter((command) => command.tabId === tabId)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

function queueCommand(input = {}) {
  const commandText = String(input.command || "").trim();
  if (!commandText) {
    throw new Error("command is required");
  }

  const command = {
    id: input.id || `command_${randomUUID().split("-")[0]}`,
    tabId: input.tabId || "shell-local",
    command: commandText,
    source: String(input.source || "typed"),
    projectId: input.projectId ? String(input.projectId) : "",
    projectPath: input.projectPath ? String(input.projectPath) : "",
    model: input.model ? String(input.model) : "",
    status: "pending",
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString()
  };

  commandDispatches.set(command.id, command);
  appendTerminalChunk({
    tabId: command.tabId,
    stream: "meta",
    chunk: `$ ${command.command}`
  });
  upsertTab({
    id: command.tabId,
    status: "running",
    summary: `${command.source} command queued from phone`
  });
  persistServerState();
  return command;
}

function claimNextCommand(tabId, input = {}) {
  const next = commandsForTab(tabId).find((command) => command.status === "pending");
  if (!next) return null;

  const claimed = {
    ...next,
    status: "claimed",
    claimedAt: new Date().toISOString(),
    claimedBy: String(input.executor || "local-daemon"),
    updatedAt: new Date().toISOString()
  };

  commandDispatches.set(claimed.id, claimed);
  upsertTab({
    id: claimed.tabId,
    status: "running",
    summary: `executing ${claimed.command}`
  });
  persistServerState();
  return claimed;
}

function lineChunks(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trimEnd())
      .filter(Boolean);
  }

  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trimEnd())
    .filter(Boolean);
}

function completeCommand(commandId, input = {}) {
  const command = commandDispatches.get(commandId);
  if (!command) return null;

  const status = String(input.status || "completed");
  const exitCode = Number(input.exitCode ?? 0);
  const finishedAt = new Date().toISOString();
  const stdoutChunks = lineChunks(input.stdout || input.stdoutChunks);
  const stderrChunks = lineChunks(input.stderr || input.stderrChunks);

  for (const chunk of stdoutChunks) {
    appendTerminalChunk({
      tabId: command.tabId,
      stream: "stdout",
      chunk
    });
  }

  for (const chunk of stderrChunks) {
    appendTerminalChunk({
      tabId: command.tabId,
      stream: "stderr",
      chunk
    });
  }

  appendTerminalChunk({
    tabId: command.tabId,
    stream: "meta",
    chunk: exitCode === 0 ? "command completed" : `command failed with exit ${exitCode}`
  });

  const tab = tabs.get(command.tabId);
  upsertTab({
    id: command.tabId,
    status: exitCode === 0 ? (tab?.mode === "terminal" ? "idle" : "running") : "blocked",
    summary: exitCode === 0 ? `last command: ${command.command}` : `command failed: ${command.command}`
  });

  const completed = {
    ...command,
    status,
    exitCode,
    finishedAt,
    updatedAt: finishedAt
  };
  commandDispatches.set(commandId, completed);
  persistServerState();
  return completed;
}

function upsertTab(input = {}) {
  const existing = tabs.get(input.id || "codex-goal") || {};
  const next = {
    ...existing,
    ...input,
    id: input.id || existing.id || "codex-goal",
    machineId: input.machineId || existing.machineId || "machine_demo_vps",
    agent: input.agent || existing.agent || "codex",
    mode: input.mode || existing.mode || "goal",
    repo: input.repo || existing.repo || "mip/noecho",
    machine: input.machine || existing.machine || "vps-helix",
    status: input.status || existing.status || "running",
    risk: input.risk || existing.risk || "safe",
    spendUsd: Number(input.spendUsd ?? existing.spendUsd ?? 0)
  };
  tabs.set(next.id, next);
  persistServerState();
  return next;
}

function createGoalRun(input) {
  const id = `goal_${randomUUID().split("-")[0]}`;
  const now = new Date().toISOString();
  const prompt = String(input.prompt || "").trim();
  const runtimeBudgetMinutes = Number(input.runtimeBudgetMinutes || 540);
  const spendBudgetUsd = Number(input.spendBudgetUsd || 15);
  const checkpointIntervalMinutes = Number(input.checkpointIntervalMinutes || 30);

  if (!prompt) {
    throw new Error("prompt is required");
  }

  const run = {
    id,
    tabId: input.tabId || "codex-goal",
    agent: input.agent || "codex",
    prompt,
    runtimeBudgetMinutes,
    spendBudgetUsd,
    checkpointIntervalMinutes,
    status: "running",
    createdAt: now,
    updatedAt: now
  };

  goalRuns.set(id, run);
  upsertTab({
    id: input.tabId || "codex-goal",
    agent: input.agent || "codex",
    mode: "goal",
    repo: "mip/noecho",
    branch: "main",
    machine: "vps-helix",
    status: "running",
    risk: "file-edit",
    spendUsd: spendBudgetUsd,
    runtime: `${Math.max(1, Math.round(runtimeBudgetMinutes / 60))}h target`,
    summary: prompt
  });
  appendTerminalChunk({
    tabId: input.tabId || "codex-goal",
    stream: "meta",
    chunk: `$ noecho goal start "${prompt}" --runtime ${runtimeBudgetMinutes}m --budget ${spendBudgetUsd}`
  });
  goalCheckpoints.set(id, [
    {
      id: `checkpoint_${randomUUID().split("-")[0]}`,
      goalRunId: id,
      label: "started",
      detail: "goal accepted by local Noecho server",
      createdAt: now
    }
  ]);
  persistServerState();
  return run;
}

function readPersistedState() {
  if (!existsSync(statePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function replaceMapEntries(map, items, keySelector) {
  map.clear();
  for (const item of Array.isArray(items) ? items : []) {
    map.set(keySelector(item), item);
  }
}

function replaceNestedMapEntries(map, items, keySelector, valueSelector) {
  map.clear();
  for (const item of Array.isArray(items) ? items : []) {
    map.set(keySelector(item), valueSelector(item));
  }
}

function persistServerState() {
  mkdirSync(stateDir, { recursive: true });
  const payload = {
    version: 1,
    profileId: activeProfileId,
    savedAt: new Date().toISOString(),
    sessions: [...sessions.values()],
    pairingCodes: [...pairingCodes.values()],
    machines: [...machines.values()],
    tabs: [...tabs.values()],
    terminalChunks: [...terminalChunks.entries()].map(([tabId, chunks]) => ({ tabId, chunks })),
    approvals: [...approvalRequests.values()],
    commandDispatches: [...commandDispatches.values()],
    goalRuns: [...goalRuns.values()],
    goalCheckpoints: [...goalCheckpoints.entries()].map(([goalRunId, checkpoints]) => ({ goalRunId, checkpoints })),
    rooms: [...rooms.values()],
    roomParticipants: [...roomParticipants.entries()].map(([roomId, participants]) => ({ roomId, participants })),
    roomMessages: [...roomMessages.entries()].map(([roomId, messages]) => ({ roomId, messages })),
    roomWorkItems: [...roomWorkItems.entries()].map(([roomId, workItems]) => ({ roomId, workItems }))
  };

  writeFileSync(statePath, `${JSON.stringify(payload, null, 2)}\n`);
  void stateStore.save(payload, activeProfileId);
}

function applyPersistedState(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;

  replaceMapEntries(sessions, snapshot.sessions, (item) => item.sessionToken);
  replaceMapEntries(pairingCodes, snapshot.pairingCodes, (item) => item.code);
  replaceMapEntries(machines, snapshot.machines, (item) => item.id);
  replaceMapEntries(tabs, snapshot.tabs, (item) => item.id);
  replaceMapEntries(approvalRequests, snapshot.approvals, (item) => item.id);
  replaceMapEntries(commandDispatches, snapshot.commandDispatches, (item) => item.id);
  replaceMapEntries(goalRuns, snapshot.goalRuns, (item) => item.id);
  replaceMapEntries(rooms, snapshot.rooms, (item) => item.id);
  replaceNestedMapEntries(terminalChunks, snapshot.terminalChunks, (item) => item.tabId, (item) => item.chunks || []);
  replaceNestedMapEntries(goalCheckpoints, snapshot.goalCheckpoints, (item) => item.goalRunId, (item) => item.checkpoints || []);
  replaceNestedMapEntries(roomParticipants, snapshot.roomParticipants, (item) => item.roomId, (item) => item.participants || []);
  replaceNestedMapEntries(roomMessages, snapshot.roomMessages, (item) => item.roomId, (item) => item.messages || []);
  replaceNestedMapEntries(roomWorkItems, snapshot.roomWorkItems, (item) => item.roomId, (item) => item.workItems || []);

  for (const [code, pairing] of pairingCodes) {
    if (pairing.expiresAt && Date.parse(pairing.expiresAt) < Date.now()) {
      pairingCodes.delete(code);
    }
  }

  if (snapshot.profileId) {
    activeProfileId = snapshot.profileId;
  }
}
const bootSnapshot = await stateStore.load();
applyPersistedState(bootSnapshot || readPersistedState());

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization,content-type,x-mpp-receipt,x-noecho-machine-token",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS"
    });
    res.end();
    return;
  }

  if (req.url === "/health") {
    sendJson(res, 200, { ok: true, service: "noecho-server", phase: "step10-live-terminal" });
    return;
  }

  if (req.url === "/openapi.json" && req.method === "GET") {
    sendJson(res, 200, openApiDocument());
    return;
  }

  if ((req.url === "/mpp/offers" || req.url === "/.well-known/mpp.json") && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      enabled: mppEnabled,
      actions: paidActions.map((action) => ({ ...action, payment: paymentInfoFor(action) }))
    });
    return;
  }

  if (req.url?.startsWith("/auth/nonce") && req.method === "GET") {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const address = url.searchParams.get("address");

    if (!address) {
      sendJson(res, 400, { ok: false, error: "address is required" });
      return;
    }

    const nonce = randomUUID();
    const issuedAt = new Date().toISOString();
    const message = `Sign in to Noecho\naddress: ${address}\nnonce: ${nonce}\nissuedAt: ${issuedAt}`;

    nonces.set(nonce, { address, message, issuedAt, expiresAt: Date.now() + 10 * 60 * 1000 });
    sendJson(res, 200, { ok: true, nonce, message, issuedAt, address, domain: origin });
    return;
  }

  if (req.url === "/auth/verify" && req.method === "POST") {
    try {
      const { address, message, nonce, signature } = await readJson(req);
      const stored = nonces.get(nonce);

      if (!stored || stored.address !== address || stored.message !== message || stored.expiresAt < Date.now()) {
        sendJson(res, 401, { ok: false, error: "invalid nonce" });
        return;
      }

      const verified = await verifyMessage({ address, message, signature });
      if (!verified) {
        sendJson(res, 401, { ok: false, error: "signature verification failed" });
        return;
      }

      if (stateStore.isHostedEnabled()) {
        activeProfileId = await stateStore.ensureProfileForAddress(address);
      }

      const sessionToken = randomUUID();
      const profileId = activeProfileId || `profile_${address.toLowerCase().slice(2, 10)}`;
      sessions.set(sessionToken, {
        sessionToken,
        profileId,
        address,
        createdAt: new Date().toISOString()
      });
      nonces.delete(nonce);
      persistServerState();

      sendJson(res, 200, {
        ok: true,
        sessionToken,
        profileId,
        walletIdentity: {
          id: `wallet_${address.toLowerCase().slice(2, 10)}`,
          chain: "eip155",
          address,
          createdAt: new Date().toISOString()
        }
      });
      return;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
      return;
    }
  }

  if (req.url?.startsWith("/auth/session") && req.method === "GET") {
    const session = getPersistedSessionForRequest(req);
    sendJson(res, session ? 200 : 404, session ? { ok: true, session } : { ok: false, error: "session not found" });
    return;
  }

  if (req.url === "/pairing/start" && req.method === "POST") {
    try {
      const session = requireSession(req, res);
      if (!session) return;
      const body = await readJson(req);
      sendJson(res, 201, { ok: true, pairing: createPairing({ ...body, profileId: session.profileId }) });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  if (req.url?.startsWith("/pairing/") && req.method === "GET") {
    const code = decodeURIComponent(req.url.split("/").pop() || "").toUpperCase();
    const pairing = pairingCodes.get(code);
    if (!pairing || Date.parse(pairing.expiresAt) < Date.now()) {
      sendJson(res, 404, { ok: false, error: "pairing code not found" });
      return;
    }

    sendJson(res, 200, { ok: true, pairing });
    return;
  }

  if (req.url === "/pairing/complete" && req.method === "POST") {
    try {
      const body = await readJson(req);
      const code = String(body.code || "").toUpperCase();
      const pairing = pairingCodes.get(code);
      if (!pairing || Date.parse(pairing.expiresAt) < Date.now()) {
        sendJson(res, 404, { ok: false, error: "pairing code not found" });
        return;
      }

      const machine = {
        id: `machine_${code.toLowerCase()}`,
        ownerId: pairing.profileId,
        name: body.machineName || pairing.machineName,
        publicKey: body.publicKey || `ssh-ed25519 ${code} noecho-pairing`,
        machineToken: body.machineToken || `machine_${randomUUID()}`,
        status: "online",
        createdAt: new Date().toISOString()
      };

      machines.set(machine.id, machine);
      pairingCodes.set(code, { ...pairing, status: "online", machineId: machine.id });
      persistServerState();
      sendJson(res, 200, { ok: true, machine, machineToken: machine.machineToken });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  if (req.url === "/machines" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      machines: [...machines.values()].map(({ machineToken, ...machine }) => machine)
    });
    return;
  }

  if (req.url === "/tabs" && req.method === "GET") {
    sendJson(res, 200, { ok: true, tabs: [...tabs.values()] });
    return;
  }

  const terminalMatch = req.url?.match(/^\/tabs\/([^/]+)\/terminal$/);
  if (terminalMatch && req.method === "GET") {
    const tabId = terminalMatch[1];
    sendJson(res, 200, { ok: true, chunks: terminalChunks.get(tabId) || [] });
    return;
  }

  const tabCommandsMatch = req.url?.match(/^\/tabs\/([^/]+)\/commands$/);
  if (tabCommandsMatch && req.method === "GET") {
    const tabId = tabCommandsMatch[1];
    sendJson(res, 200, { ok: true, commands: commandsForTab(tabId) });
    return;
  }

  if (tabCommandsMatch && req.method === "POST") {
    try {
      const session = requireSession(req, res);
      if (!session) return;
      const tabId = tabCommandsMatch[1];
      if (!tabs.has(tabId)) {
        sendJson(res, 404, { ok: false, error: "tab not found" });
        return;
      }

      const body = await readJson(req);
      const command = queueCommand({ ...body, tabId });
      sendJson(res, 202, { ok: true, command });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  const claimCommandMatch = req.url?.match(/^\/tabs\/([^/]+)\/commands\/claim$/);
  if (claimCommandMatch && req.method === "POST") {
    try {
      const machine = requireMachine(req, res);
      if (!machine) return;
      const tabId = claimCommandMatch[1];
      const body = await readJson(req);
      const command = claimNextCommand(tabId, { ...body, executor: body.executor || machine.name });
      sendJson(res, 200, { ok: true, command });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  const completeCommandMatch = req.url?.match(/^\/commands\/([^/]+)\/complete$/);
  if (completeCommandMatch && req.method === "POST") {
    try {
      const machine = requireMachine(req, res);
      if (!machine) return;
      const body = await readJson(req);
      const command = completeCommand(completeCommandMatch[1], body);
      if (!command) {
        sendJson(res, 404, { ok: false, error: "command not found" });
        return;
      }
      sendJson(res, 200, { ok: true, command });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  if (req.url === "/approvals" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      approvals: [...approvalRequests.values()].filter((approval) => approval.status !== "resolved")
    });
    return;
  }

  const resolveApprovalMatch = req.url?.match(/^\/approvals\/([^/]+)\/resolve$/);
  if (resolveApprovalMatch && req.method === "POST") {
    const approval = approvalRequests.get(resolveApprovalMatch[1]);
    if (!approval) {
      sendJson(res, 404, { ok: false, error: "approval not found" });
      return;
    }
    if (!requireSession(req, res)) return;
    approvalRequests.set(approval.id, { ...approval, status: "resolved" });
    persistServerState();
    sendJson(res, 200, { ok: true, approval: { ...approval, status: "resolved" } });
    return;
  }

  if (req.url === "/goals" && req.method === "GET") {
    const runs = [...goalRuns.values()].map((run) => ({
      ...run,
      checkpoints: goalCheckpoints.get(run.id) || []
    }));
    sendJson(res, 200, { ok: true, runs });
    return;
  }

  if (req.url === "/goals" && req.method === "POST") {
    try {
      const session = requireSession(req, res);
      if (!session) return;
      const body = await readJson(req);
      const run = createGoalRun({ ...body, profileId: session.profileId });
      sendJson(res, 201, { ok: true, run, checkpoints: goalCheckpoints.get(run.id) || [] });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  const checkpointMatch = req.url?.match(/^\/goals\/([^/]+)\/checkpoints$/);
  if (checkpointMatch && req.method === "POST") {
    try {
      const session = requireSession(req, res);
      if (!session) return;
      const goalRunId = checkpointMatch[1];
      const run = goalRuns.get(goalRunId);
      if (!run) {
        sendJson(res, 404, { ok: false, error: "goal not found" });
        return;
      }

      const body = await readJson(req);
      const checkpoint = {
        id: `checkpoint_${randomUUID().split("-")[0]}`,
        goalRunId,
        label: String(body.label || "checkpoint"),
        detail: String(body.detail || "agent checkpoint"),
        createdAt: new Date().toISOString()
      };
      const checkpoints = goalCheckpoints.get(goalRunId) || [];
      checkpoints.push(checkpoint);
      goalCheckpoints.set(goalRunId, checkpoints);
      goalRuns.set(goalRunId, { ...run, updatedAt: checkpoint.createdAt });
      persistServerState();
      sendJson(res, 201, { ok: true, checkpoint });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  if (req.url === "/daemon/sync" && req.method === "POST") {
    try {
      const machine = requireMachine(req, res);
      if (!machine) return;
      const body = await readJson(req);
      const tab = body.tab ? upsertTab(body.tab) : null;
      const chunks = Array.isArray(body.chunks) ? body.chunks.map((chunk) => appendTerminalChunk(chunk)) : [];
      const approvals = Array.isArray(body.approvals) ? body.approvals.map((approval) => createApproval(approval)) : [];

      if (body.goalCheckpoint?.goalRunId) {
        const run = goalRuns.get(body.goalCheckpoint.goalRunId);
        if (run) {
          const checkpoint = {
            id: `checkpoint_${randomUUID().split("-")[0]}`,
            goalRunId: body.goalCheckpoint.goalRunId,
            label: String(body.goalCheckpoint.label || "checkpoint"),
            detail: String(body.goalCheckpoint.detail || "agent checkpoint"),
            createdAt: new Date().toISOString()
          };
          const items = goalCheckpoints.get(run.id) || [];
          items.push(checkpoint);
          goalCheckpoints.set(run.id, items);
          goalRuns.set(run.id, { ...run, updatedAt: checkpoint.createdAt });
          persistServerState();
        }
      }

      sendJson(res, 200, { ok: true, tab, chunks, approvals });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  if (req.url === "/rooms" && req.method === "GET") {
    const session = requireSession(req, res);
    if (!session) return;
    const visibleRooms = [...rooms.values()].filter((room) => room.profileId === session.profileId || session.demo);
    sendJson(res, 200, {
      ok: true,
      rooms: visibleRooms.map((room) => ({
        ...room,
        participants: participantsForRoom(room.id),
        latestMessage: messagesForRoom(room.id).at(-1) || null
      }))
    });
    return;
  }

  if (req.url === "/rooms" && req.method === "POST") {
    try {
      const session = requireSession(req, res);
      if (!session) return;
      const body = await readJson(req);
      const room = createRoom({ ...body, profileId: session.profileId });
      sendJson(res, 201, {
        ok: true,
        room,
        participants: participantsForRoom(room.id),
        messages: messagesForRoom(room.id)
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  const roomMessagesMatch = req.url?.match(/^\/rooms\/([^/]+)\/messages$/);
  if (roomMessagesMatch && req.method === "GET") {
    const session = requireSession(req, res);
    if (!session) return;
    const roomId = roomMessagesMatch[1];
    const room = rooms.get(roomId);
    if (!room || (room.profileId !== session.profileId && !session.demo)) {
      sendJson(res, 404, { ok: false, error: "room not found" });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      room,
      participants: participantsForRoom(roomId),
      messages: messagesForRoom(roomId)
    });
    return;
  }

  if (roomMessagesMatch && req.method === "POST") {
    try {
      const session = requireSession(req, res);
      if (!session) return;
      const roomId = roomMessagesMatch[1];
      const room = rooms.get(roomId);
      if (!room || (room.profileId !== session.profileId && !session.demo)) {
        sendJson(res, 404, { ok: false, error: "room not found" });
        return;
      }
      const body = await readJson(req);
      const message = appendRoomMessage(roomId, {
        ...body,
        authorKind: "user",
        authorLabel: body.authorLabel || "You"
      });
      sendJson(res, 201, {
        ok: true,
        message,
        workItems: workForRoom(roomId).filter((item) => item.messageId === message.id)
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  const roomParticipantsMatch = req.url?.match(/^\/rooms\/([^/]+)\/participants$/);
  if (roomParticipantsMatch && req.method === "POST") {
    try {
      const session = requireSession(req, res);
      if (!session) return;
      const roomId = roomParticipantsMatch[1];
      const room = rooms.get(roomId);
      if (!room || (room.profileId !== session.profileId && !session.demo)) {
        sendJson(res, 404, { ok: false, error: "room not found" });
        return;
      }
      const participant = addRoomParticipant(roomId, await readJson(req));
      sendJson(res, 201, { ok: true, participant });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  const removeParticipantMatch = req.url?.match(/^\/rooms\/([^/]+)\/participants\/([^/]+)$/);
  if (removeParticipantMatch && req.method === "DELETE") {
    const session = requireSession(req, res);
    if (!session) return;
    const roomId = removeParticipantMatch[1];
    const room = rooms.get(roomId);
    if (!room || (room.profileId !== session.profileId && !session.demo)) {
      sendJson(res, 404, { ok: false, error: "room not found" });
      return;
    }
    removeRoomParticipant(roomId, removeParticipantMatch[2]);
    sendJson(res, 200, { ok: true });
    return;
  }

  const claimRoomWorkMatch = req.url?.match(/^\/daemon\/rooms\/([^/]+)\/work\/claim$/);
  if (claimRoomWorkMatch && req.method === "POST") {
    try {
      const machine = requireMachine(req, res);
      if (!machine) return;
      const body = await readJson(req);
      const work = claimNextRoomWork(claimRoomWorkMatch[1], { ...body, executor: body.executor || machine.name });
      sendJson(res, 200, { ok: true, work });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  const completeRoomWorkMatch = req.url?.match(/^\/daemon\/work\/([^/]+)\/complete$/);
  if (completeRoomWorkMatch && req.method === "POST") {
    try {
      const machine = requireMachine(req, res);
      if (!machine) return;
      const work = completeRoomWork(completeRoomWorkMatch[1], await readJson(req));
      if (!work) {
        sendJson(res, 404, { ok: false, error: "work not found" });
        return;
      }
      sendJson(res, 200, { ok: true, work });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  if (req.url?.startsWith("/paid/") && req.method === "POST") {
    const action = paidActions.find((item) => req.url === item.path);
    if (!action) {
      sendJson(res, 404, { ok: false, error: "paid action not found" });
      return;
    }

    const paymentCredential = req.headers.authorization || req.headers["x-mpp-receipt"];

    if (mppEnabled && !paymentCredential) {
      sendPaymentRequired(res, action);
      return;
    }

    sendJson(res, 200, {
      ok: true,
      paid: mppEnabled,
      action: action.id,
      title: action.title,
      receipt: paymentCredential || "dev-mode-free-tier",
      result: `${action.title} accepted`
    });
    return;
  }

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("noecho self-hosted server scaffold\n");
}).listen(port, host, () => {
  console.log(`noecho server listening at http://${host}:${port}`);
});
