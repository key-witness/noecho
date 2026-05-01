import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { verifyMessage } from "viem";

const port = Number(process.env.PORT || 4010);
const origin = process.env.NOECHO_WEB_ORIGIN || "http://127.0.0.1:3002";
const publicBaseUrl = process.env.NOECHO_PUBLIC_BASE_URL || `http://127.0.0.1:${port}`;
const mppEnabled = process.env.NOECHO_MPP_ENABLED === "true";
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
const goalRuns = new Map();
const goalCheckpoints = new Map();
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
    "access-control-allow-headers": "authorization,content-type,x-mpp-receipt",
    "access-control-allow-methods": "GET,POST,OPTIONS"
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
    command: `noecho pair ${code}`,
    status: "pairing",
    createdAt: now,
    expiresAt
  };

  pairingCodes.set(code, pairing);
  return pairing;
}

function createApproval(input = {}) {
  const approval = {
    id: input.id || `approval_${randomUUID().split("-")[0]}`,
    tabId: input.tabId || "codex-goal",
    title: String(input.title || "Approval required"),
    detail: String(input.detail || "Agent action requires approval."),
    risk: String(input.risk || "safe"),
    amountUsd: Number(input.amountUsd || 0),
    createdAt: input.createdAt || new Date().toISOString(),
    status: String(input.status || "pending")
  };
  approvalRequests.set(approval.id, approval);
  return approval;
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
  return chunk;
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
  return run;
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization,content-type,x-mpp-receipt",
      "access-control-allow-methods": "GET,POST,OPTIONS"
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

      const sessionToken = randomUUID();
      const profileId = `profile_${address.toLowerCase().slice(2, 10)}`;
      sessions.set(sessionToken, {
        sessionToken,
        profileId,
        address,
        createdAt: new Date().toISOString()
      });
      nonces.delete(nonce);

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
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const token = url.searchParams.get("token");
    const session = token ? sessions.get(token) : null;
    sendJson(res, session ? 200 : 404, session ? { ok: true, session } : { ok: false, error: "session not found" });
    return;
  }

  if (req.url === "/pairing/start" && req.method === "POST") {
    try {
      const body = await readJson(req);
      sendJson(res, 201, { ok: true, pairing: createPairing(body) });
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
        status: "online",
        createdAt: new Date().toISOString()
      };

      machines.set(machine.id, machine);
      pairingCodes.set(code, { ...pairing, status: "online", machineId: machine.id });
      sendJson(res, 200, { ok: true, machine });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  if (req.url === "/machines" && req.method === "GET") {
    sendJson(res, 200, { ok: true, machines: [...machines.values()] });
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
    approvalRequests.set(approval.id, { ...approval, status: "resolved" });
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
      const body = await readJson(req);
      const run = createGoalRun(body);
      sendJson(res, 201, { ok: true, run, checkpoints: goalCheckpoints.get(run.id) || [] });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  const checkpointMatch = req.url?.match(/^\/goals\/([^/]+)\/checkpoints$/);
  if (checkpointMatch && req.method === "POST") {
    try {
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
      sendJson(res, 201, { ok: true, checkpoint });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  if (req.url === "/daemon/sync" && req.method === "POST") {
    try {
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
        }
      }

      sendJson(res, 200, { ok: true, tab, chunks, approvals });
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
}).listen(port, "127.0.0.1", () => {
  console.log(`noecho server scaffold listening at http://127.0.0.1:${port}`);
});
