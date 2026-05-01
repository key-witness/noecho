import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { verifyMessage } from "viem";

const port = Number(process.env.PORT || 4010);
const origin = process.env.NOECHO_WEB_ORIGIN || "http://127.0.0.1:3002";
const nonces = new Map();
const sessions = new Map();
const goalRuns = new Map();
const goalCheckpoints = new Map();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "content-type",
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
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    });
    res.end();
    return;
  }

  if (req.url === "/health") {
    sendJson(res, 200, { ok: true, service: "noecho-server", phase: "step5-wallet-auth" });
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

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("noecho self-hosted server scaffold\n");
}).listen(port, "127.0.0.1", () => {
  console.log(`noecho server scaffold listening at http://127.0.0.1:${port}`);
});
