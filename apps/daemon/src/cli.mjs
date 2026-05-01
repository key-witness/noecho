#!/usr/bin/env node

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

function parseOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function parseHours(value) {
  if (!value) return 9;
  return Number(String(value).replace("h", ""));
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const target = new URL(url);
    const req = request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body)
        }
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
    req.end(body);
  });
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
      console.log(`paired: ${data.machine.name} (${data.machine.id})`);
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
  default:
    printHelp();
}
