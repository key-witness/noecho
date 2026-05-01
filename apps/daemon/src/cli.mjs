#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const command = process.argv[2] || "help";

function printHelp() {
  console.log(`noecho daemon scaffold

commands:
  noecho pair      create a pairing code for the phone PWA
  noecho doctor    check local agent prerequisites
  noecho goal      placeholder for long-running goal jobs
`);
}

function pair() {
  const code = randomUUID().split("-")[0].toUpperCase();
  console.log("noecho pair");
  console.log(`pairing code: ${code}`);
  console.log("open the phone PWA and enter this code. QR support lands in the pairing step.");
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

switch (command) {
  case "pair":
    pair();
    break;
  case "doctor":
    doctor();
    break;
  case "goal":
    console.log("goal runner placeholder: implement daemon-managed /goal in Step 13");
    break;
  default:
    printHelp();
}
