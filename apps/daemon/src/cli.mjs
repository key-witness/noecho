#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { join } from "node:path";

const command = process.argv[2] || "help";
const stateDir = join(process.cwd(), ".noecho");
const statePath = join(stateDir, "daemon-state.json");

function printHelp() {
  console.log(`noecho daemon scaffold

commands:
  noecho pair      create or complete a pairing code for the phone PWA
  noecho doctor    check local agent prerequisites
  noecho goal      manage long-running /goal jobs
  noecho stream    send sample live activity to the local Noecho server
  noecho room      claim model-room work for codex and claude
`);
}

function readState() {
  if (!existsSync(statePath)) {
    return { goals: [] };
  }

  return JSON.parse(readFileSync(statePath, "utf8"));
}

function writeState(state) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function machineTokenHeaders() {
  const state = readState();
  const machineToken = state.machineToken || parseOption("--machine-token", process.env.NOECHO_MACHINE_TOKEN || "");
  return machineToken ? { "x-noecho-machine-token": machineToken } : {};
}

function parseOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function parseHours(value) {
  if (!value) return 9;
  return Number(String(value).replace("h", ""));
}

function requestJson(url, { method = "GET", body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = body === undefined ? "" : JSON.stringify(body);
    const req = request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers: payload
          ? {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(payload),
              ...headers
            }
          : Object.keys(headers).length ? headers : undefined
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          const data = responseBody ? JSON.parse(responseBody) : {};
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(data.error || `request failed with ${res.statusCode}`));
            return;
          }
          resolve(data);
        });
      }
    );

    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function postJson(url, payload) {
  return requestJson(url, { method: "POST", body: payload });
}

function postJsonWithMachine(url, payload) {
  return requestJson(url, { method: "POST", body: payload, headers: machineTokenHeaders() });
}

function pair() {
  const code = (process.argv[3] || randomUUID().split("-")[0]).toUpperCase();
  const server = parseOption("--server", "");
  const machineName = parseOption("--name", "local-daemon");

  console.log("noecho pair");
  console.log(`pairing code: ${code}`);
  console.log(`machine: ${machineName}`);

  if (!server) {
    console.log("open the phone PWA and enter this code. QR support lands in the pairing step.");
    return;
  }

  postJson(`${server.replace(/\/$/, "")}/pairing/complete`, {
    code,
    machineName,
    publicKey: `ssh-ed25519 ${code} noecho-${machineName}`
  })
    .then((data) => {
      const state = readState();
      writeState({
        ...state,
        machineId: data.machine.id,
        machineName: data.machine.name,
        machineToken: data.machineToken,
        server
      });
      console.log(`paired: ${data.machine.name} (${data.machine.id})`);
      console.log(`machine token stored in ${statePath}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "pairing failed");
      process.exitCode = 1;
    });
}

function doctor() {
  console.log("noecho doctor");
  console.log(`node: ${process.version}`);
  console.log("git: pending check");
  console.log("claude: pending check");
  console.log("codex: pending check");
  console.log("opencode: pending check");
  console.log("status: scaffold ready");
}

function goalHelp() {
  console.log(`noecho goal

commands:
  noecho goal start "prompt" --agent codex --runtime 9h --budget 15
  noecho goal status
  noecho goal checkpoint "label" "detail"
`);
}

function goalStart() {
  const prompt = process.argv[4];
  if (!prompt) {
    console.error("goal prompt is required");
    process.exitCode = 1;
    return;
  }

  const state = readState();
  const now = new Date().toISOString();
  const goal = {
    id: `goal_${randomUUID().split("-")[0]}`,
    agent: parseOption("--agent", "codex"),
    prompt,
    runtimeHours: parseHours(parseOption("--runtime", "9h")),
    spendBudgetUsd: Number(parseOption("--budget", "15")),
    checkpointIntervalMinutes: Number(parseOption("--checkpoint", "30")),
    status: "running",
    createdAt: now,
    updatedAt: now,
    checkpoints: [
      {
        label: "started",
        detail: "daemon accepted goal; adapter execution wiring comes next",
        createdAt: now
      }
    ]
  };

  state.goals = [goal, ...(state.goals || [])];
  writeState(state);

  console.log("noecho goal start");
  console.log(`id: ${goal.id}`);
  console.log(`agent: ${goal.agent}`);
  console.log(`runtime: ${goal.runtimeHours}h`);
  console.log(`budget: $${goal.spendBudgetUsd}`);
  console.log(`state: ${statePath}`);
}

function goalStatus() {
  const state = readState();
  const goals = state.goals || [];
  if (!goals.length) {
    console.log("no goal runs yet");
    return;
  }

  for (const goal of goals.slice(0, 5)) {
    const checkpoint = goal.checkpoints?.[goal.checkpoints.length - 1];
    console.log(`${goal.id} ${goal.status} ${goal.agent} ${goal.runtimeHours}h $${goal.spendBudgetUsd}`);
    console.log(`  prompt: ${goal.prompt}`);
    console.log(`  last: ${checkpoint?.label || "none"} · ${checkpoint?.detail || "no checkpoint"}`);
  }
}

function goalCheckpoint() {
  const label = process.argv[4] || "checkpoint";
  const detail = process.argv[5] || "manual checkpoint";
  const state = readState();
  const goal = state.goals?.find((item) => item.status === "running") || state.goals?.[0];

  if (!goal) {
    console.error("no goal run found");
    process.exitCode = 1;
    return;
  }

  goal.checkpoints = goal.checkpoints || [];
  goal.checkpoints.push({ label, detail, createdAt: new Date().toISOString() });
  goal.updatedAt = goal.checkpoints[goal.checkpoints.length - 1].createdAt;
  writeState(state);
  console.log(`checkpoint added to ${goal.id}`);
}

function goal() {
  const subcommand = process.argv[3] || "help";

  if (subcommand === "start") {
    goalStart();
  } else if (subcommand === "status") {
    goalStatus();
  } else if (subcommand === "checkpoint") {
    goalCheckpoint();
  } else {
    goalHelp();
  }
}

function streamHelp() {
  console.log(`noecho stream

commands:
  noecho stream demo --server http://127.0.0.1:4010 --tab codex-goal
`);
}

function streamDemo() {
  const server = parseOption("--server", "http://127.0.0.1:4010");
  const tabId = parseOption("--tab", "codex-goal");
  const goalRunId = parseOption("--goal", "");

  postJsonWithMachine(`${server.replace(/\/$/, "")}/daemon/sync`, {
    tab: {
      id: tabId,
      agent: "codex",
      mode: "goal",
      repo: "mip/noecho",
      branch: "main",
      machine: "vps-helix",
      status: "running",
      risk: "file-edit",
      spendUsd: 2.64,
      runtime: "3h 41m / 9h",
      summary: "streaming terminal progress from local daemon"
    },
    chunks: [
      { tabId, stream: "meta", chunk: "$ codex goal continue --checkpoint" },
      { tabId, stream: "stdout", chunk: "syncing live terminal chunks to phone cockpit" },
      { tabId, stream: "stdout", chunk: "ran targeted UI checks for setup, goal, and spend" },
      { tabId, stream: "stderr", chunk: "approval required · push branch after final review" }
    ],
    approvals: [
      {
        tabId,
        title: "Push branch after live sync pass",
        detail: "codex wants approval to push the updated cockpit sync changes after tests.",
        risk: "push",
        amountUsd: 0.04
      }
    ],
    goalCheckpoint: goalRunId
      ? {
          goalRunId,
          label: "live sync",
          detail: "daemon posted terminal chunks and approval state to phone cockpit"
        }
      : undefined
  })
    .then(() => {
      console.log(`streamed demo activity to ${server}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "stream failed");
      process.exitCode = 1;
    });
}

function stream() {
  const subcommand = process.argv[3] || "help";

  if (subcommand === "demo") {
    streamDemo();
  } else {
    streamHelp();
  }
}

function dispatchHelp() {
  console.log(`noecho dispatch

commands:
  noecho dispatch once --server http://127.0.0.1:4010 --tab shell-local
  noecho dispatch loop --server http://127.0.0.1:4010 --tab shell-local --interval 2
`);
}

function runShellCommand(commandText) {
  return new Promise((resolve) => {
    const child = spawn(process.env.SHELL || "zsh", ["-lc", commandText], {
      cwd: process.cwd(),
      env: process.env
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      resolve({ exitCode: 1, stdout, stderr });
    });

    child.on("close", (code) => {
      resolve({ exitCode: Number(code ?? 1), stdout, stderr });
    });
  });
}

async function dispatchOnce() {
  const server = parseOption("--server", "http://127.0.0.1:4010");
  const tabId = parseOption("--tab", "shell-local");
  const executor = parseOption("--executor", "local-daemon");
  const claimResponse = await postJsonWithMachine(`${server.replace(/\/$/, "")}/tabs/${encodeURIComponent(tabId)}/commands/claim`, {
    executor
  });
  const commandItem = claimResponse.command;

  if (!commandItem) {
    console.log(`no pending commands for ${tabId}`);
    return;
  }

  console.log(`running ${commandItem.id}: ${commandItem.command}`);
  const result = await runShellCommand(commandItem.command);
  await postJsonWithMachine(`${server.replace(/\/$/, "")}/commands/${encodeURIComponent(commandItem.id)}/complete`, {
    status: result.exitCode === 0 ? "completed" : "failed",
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr
  });
  console.log(`finished ${commandItem.id} with exit ${result.exitCode}`);
}

function roomHelp() {
  console.log(`noecho room

commands:
  noecho room once --server http://127.0.0.1:4010 --room room_id --agents codex,claude
  noecho room loop --server http://127.0.0.1:4010 --room room_id --agents codex,claude --interval 2
`);
}

function simulatedAgentReply(work) {
  const agent = work.agent || "agent";
  const prompt = work.prompt || "";
  if (/push|deploy|install|secret|payment|spend|rm |delete/i.test(prompt)) {
    return {
      body: `${agent}: I need approval before I run the requested risky step.`,
      proposedAction: {
        title: `${agent} wants approval`,
        detail: prompt,
        risk: /deploy/i.test(prompt) ? "deploy" : /payment|spend/i.test(prompt) ? "payment" : "shell",
        amountUsd: 0
      }
    };
  }

  return {
    body: `${agent}: acknowledged. I would inspect the repo, make the smallest change, and report back with tests.`
  };
}

async function runAgentWork(work) {
  if (process.env.NOECHO_EXECUTE_AGENTS !== "true") {
    return simulatedAgentReply(work);
  }

  const agent = work.agent || "agent";
  const prompt = work.prompt || "";
  const commandText = agent === "claude"
    ? `claude -p ${JSON.stringify(prompt)}`
    : agent === "codex"
      ? `codex exec ${JSON.stringify(prompt)}`
      : "";

  if (!commandText) {
    return simulatedAgentReply(work);
  }

  const result = await runShellCommand(commandText);
  return {
    body: result.exitCode === 0
      ? `${agent}: ${result.stdout || "completed"}`
      : `${agent}: command failed\n${result.stderr || result.stdout}`,
    proposedAction: undefined
  };
}

async function roomOnce() {
  const server = parseOption("--server", process.env.NOECHO_SERVER_URL || "http://127.0.0.1:4010");
  const roomId = parseOption("--room", "");
  const agents = parseOption("--agents", "codex,claude").split(",").map((item) => item.trim()).filter(Boolean);
  const executor = parseOption("--executor", readState().machineName || "local-daemon");

  if (!roomId) {
    console.error("room id is required");
    process.exitCode = 1;
    return;
  }

  const claimResponse = await postJsonWithMachine(`${server.replace(/\/$/, "")}/daemon/rooms/${encodeURIComponent(roomId)}/work/claim`, {
    executor,
    agents
  });
  const work = claimResponse.work;

  if (!work) {
    console.log(`no pending room work for ${roomId}`);
    return;
  }

  console.log(`claimed ${work.id} for ${work.agent}`);
  const reply = await runAgentWork(work);
  await postJsonWithMachine(`${server.replace(/\/$/, "")}/daemon/work/${encodeURIComponent(work.id)}/complete`, {
    status: "completed",
    authorLabel: work.agent,
    body: reply.body,
    proposedAction: reply.proposedAction
  });
  console.log(`completed ${work.id}`);
}

function roomLoop() {
  const intervalSeconds = Number(parseOption("--interval", "2"));
  const tick = async () => {
    try {
      await roomOnce();
    } catch (error) {
      console.error(error instanceof Error ? error.message : "room loop failed");
    }
  };
  tick();
  setInterval(tick, Math.max(1, intervalSeconds) * 1000);
}

function room() {
  const subcommand = process.argv[3] || "help";
  if (subcommand === "once") {
    roomOnce().catch((error) => {
      console.error(error instanceof Error ? error.message : "room failed");
      process.exitCode = 1;
    });
  } else if (subcommand === "loop") {
    roomLoop();
  } else {
    roomHelp();
  }
}

function dispatchLoop() {
  const intervalSeconds = Number(parseOption("--interval", "2"));

  const tick = async () => {
    try {
      await dispatchOnce();
    } catch (error) {
      console.error(error instanceof Error ? error.message : "dispatch failed");
    }
  };

  tick();
  setInterval(tick, Math.max(1, intervalSeconds) * 1000);
}

function dispatch() {
  const subcommand = process.argv[3] || "help";

  if (subcommand === "once") {
    dispatchOnce().catch((error) => {
      console.error(error instanceof Error ? error.message : "dispatch failed");
      process.exitCode = 1;
    });
  } else if (subcommand === "loop") {
    dispatchLoop();
  } else {
    dispatchHelp();
  }
}

switch (command) {
  case "pair":
    pair();
    break;
  case "doctor":
    doctor();
    break;
  case "goal":
    goal();
    break;
  case "stream":
    stream();
    break;
  case "dispatch":
    dispatch();
    break;
  case "room":
    room();
    break;
  default:
    printHelp();
}
