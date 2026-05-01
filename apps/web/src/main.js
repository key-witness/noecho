const state = {
  activeTabId: "codex-goal",
  activeView: new URLSearchParams(window.location.search).get("view") || "terminal",
  recording: false,
  wallet: {
    status: "disconnected",
    address: "",
    sessionToken: "",
    profileId: "",
    mode: "wallet"
  },
  authNotice: "wallet login is the default entry point",
  goalRunId: "",
  goalNotice: "ready to start a 9h codex /goal run",
  goalRuns: [],
  goalCheckpoints: [],
  pairing: {
    status: "idle",
    code: "",
    command: "noecho pair",
    notice: "run the daemon on your laptop or VPS"
  },
  machines: [],
  availableOffers: [],
  selectedProjectId: "noecho",
  selectedModel: "codex"
};

const authServerBase = "http://127.0.0.1:4010";
const storageKey = "noecho-phone-state-v1";
let syncTimer = null;

const agentTabs = [
  {
    id: "codex-goal",
    agent: "codex",
    mode: "/goal",
    repo: "mip/noecho",
    branch: "main",
    machine: "vps-helix",
    status: "running",
    risk: "file-edit",
    spend: "$2.18",
    runtime: "3h 12m / 9h",
    summary: "hardening pairing flow and worker checkpoints"
  },
  {
    id: "claude-review",
    agent: "claude",
    mode: "review",
    repo: "mip/noecho",
    branch: "ui-step2",
    machine: "macbook",
    status: "needs approval",
    risk: "push",
    spend: "$0.42",
    runtime: "18m",
    summary: "review found 2 warnings in websocket retry logic"
  },
  {
    id: "opencode-audit",
    agent: "opencode",
    mode: "audit",
    repo: "contracts/vault",
    branch: "audit/prelaunch",
    machine: "vps-helix",
    status: "blocked",
    risk: "shell",
    spend: "$0.76",
    runtime: "41m",
    summary: "waiting for slither install approval"
  },
  {
    id: "shell-local",
    agent: "shell",
    mode: "terminal",
    repo: "local/noecho",
    branch: "main",
    machine: "macbook",
    status: "idle",
    risk: "safe",
    spend: "free",
    runtime: "ready",
    summary: "paired and ready for manual commands"
  }
];

const terminalLines = {
  "codex-goal": [
    ["dim", "$ noecho goal start \"make mobile cockpit production ready\" --runtime 9h --budget 15"],
    ["ok", "wallet verified 0x8f2c...91b4 · mpp session open"],
    ["dim", "paired machine vps-helix online · codex available"],
    ["info", "checkpoint 08:15 · mapped app shell and prompt deck"],
    ["warn", "approval required · modify supabase migration policy comments"],
    ["ok", "checkpoint 09:02 · tests scaffolded · no destructive commands"],
    ["dim", "current: consolidating mobile terminal layout"],
    ["live", "codex is editing apps/web/src/styles.css"]
  ],
  "claude-review": [
    ["dim", "$ noecho review --agent claude --target ui-step2"],
    ["info", "reading diff and event protocol notes"],
    ["warn", "warning · reconnect retry has no backoff cap"],
    ["warn", "warning · terminal chunks need redaction before sync"],
    ["ok", "pass · approval cards clearly gate risky actions"],
    ["live", "waiting for user approval: create PR summary"]
  ],
  "opencode-audit": [
    ["dim", "$ noecho macro audit-contract"],
    ["ok", "found foundry.toml and hardhat.config.ts"],
    ["warn", "slither not installed on vps-helix"],
    ["info", "suggested command: pipx install slither-analyzer"],
    ["live", "blocked until shell install is approved"]
  ],
  "shell-local": [
    ["dim", "$ noecho doctor"],
    ["ok", "node v24.6.0"],
    ["ok", "git available"],
    ["dim", "claude pending"],
    ["dim", "codex pending"],
    ["ok", "local shell tab ready"]
  ]
};

const prompts = [
  { title: "fix build", lane: "agent", price: "free", risk: "file-edit", phrase: "fix build and retest" },
  { title: "continue goal", lane: "agent", price: "session", risk: "file-edit", phrase: "continue the goal" },
  { title: "pause all", lane: "safety", price: "free", risk: "safe", phrase: "pause all agents" },
  { title: "audit contract", lane: "crypto", price: "$1.20", risk: "shell", phrase: "audit this contract" },
  { title: "gas snapshot", lane: "crypto", price: "$0.30", risk: "shell", phrase: "run gas snapshot" },
  { title: "find env leaks", lane: "safety", price: "$0.15", risk: "safe", phrase: "check for leaked env" },
  { title: "ship preview", lane: "vibe", price: "$0.18", risk: "deploy", phrase: "ship preview" },
  { title: "make UI tighter", lane: "vibe", price: "$0.40", risk: "file-edit", phrase: "make it cleaner" }
];

const byokKeys = [
  { label: "openai", hint: "voice + gpt", value: "sk-••••••••••••", status: "ready", tone: "ok" },
  { label: "anthropic", hint: "claude code", value: "demo-anthropic-key", status: "ready", tone: "warn" },
  { label: "github", hint: "repos + prs", value: "ghp_••••••••••", status: "local", tone: "info" }
];

const projects = [
  { id: "noecho", name: "noecho", path: "mip/noecho", branch: "main", machine: "vps-helix" },
  { id: "vault", name: "vault", path: "contracts/vault", branch: "audit/prelaunch", machine: "vps-helix" },
  { id: "api", name: "api-server", path: "mip/api-server", branch: "develop", machine: "macbook" }
];

const approvals = [
  {
    title: "Install Slither on vps-helix",
    detail: "opencode wants to run pipx install slither-analyzer for smart-contract audit tooling.",
    risk: "shell",
    amount: "$0.00",
    tab: "opencode"
  },
  {
    title: "Push ui-step2 branch",
    detail: "claude review is ready to push 6 changed files and create a draft PR.",
    risk: "push",
    amount: "$0.04",
    tab: "claude"
  },
  {
    title: "Extend /goal by 2 hours",
    detail: "codex estimates another 2 hours for pairing tests and spend controls.",
    risk: "payment",
    amount: "$3.00 max",
    tab: "codex"
  }
];

const checkpoints = [
  { time: "09:02", title: "mobile shell", detail: "terminal, tabs, prompt deck wired with mock state" },
  { time: "08:15", title: "protocol map", detail: "machines, tabs, approvals, receipts, goals" },
  { time: "07:48", title: "safety profile", detail: "push/deploy/payment/signing require approval" }
];

const history = [
  { title: "auth API + JWT", repo: "mip/api-server", meta: "4 files · tests passed · $0.72" },
  { title: "landing polish", repo: "mip/site", meta: "6 files · preview deployed · $0.38" },
  { title: "vault audit prep", repo: "contracts/vault", meta: "blocked · install required · $0.76" },
  { title: "noecho scaffold", repo: "mip/noecho", meta: "committed · free local" }
];

const receipts = [
  { label: "goal session", amount: "$2.18", detail: "codex /goal · 3h 12m" },
  { label: "review", amount: "$0.42", detail: "claude review pass" },
  { label: "audit scan", amount: "$0.76", detail: "opencode contract audit" }
];

const settings = [
  ["account", "wallet 0x8f2c...91b4 · supporter beta"],
  ["machines", "vps-helix online · macbook paired"],
  ["agents", "codex, claude, opencode, shell"],
  ["permissions", "approve push, deploy, payment, signing"],
  ["voice", "push-to-talk · macro phrases enabled"],
  ["safety", "$15 goal cap · panic stop armed"]
];

const views = [
  ["setup", "setup"],
  ["terminal", "terminal"],
  ["prompts", "prompts"],
  ["goal", "/goal"],
  ["approvals", "approvals"],
  ["history", "history"],
  ["spend", "spend"],
  ["settings", "settings"]
];

function activeTab() {
  return agentTabs.find((tab) => tab.id === state.activeTabId) || agentTabs[0];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusTone(status) {
  if (status.includes("approval") || status === "blocked") return "warn";
  if (status === "running") return "live";
  if (status === "idle") return "idle";
  return "ok";
}

function walletLabel() {
  if (!state.wallet.address) return "wallet";
  return `${state.wallet.address.slice(0, 6)}...${state.wallet.address.slice(-4)}`;
}

function renderHeader(tab) {
  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">speak to ship</p>
        <h1>noecho</h1>
      </div>
      <button class="wallet ${state.wallet.status === "connected" ? "is-connected" : ""}" type="button" data-view="spend">
        <span>${escapeHtml(state.wallet.status === "connected" ? walletLabel() : "wallet")}</span>
        <strong>${escapeHtml(state.wallet.status === "connected" ? state.wallet.mode : "$12.82")}</strong>
      </button>
    </header>
    <section class="session-strip" aria-label="Current session">
      <div>
        <span class="session-strip__label">active</span>
        <strong>${escapeHtml(tab.agent)} · ${escapeHtml(tab.mode)}</strong>
      </div>
      <div>
        <span class="session-strip__label">machine</span>
        <strong>${escapeHtml(tab.machine)}</strong>
      </div>
      <div>
        <span class="session-strip__label">risk</span>
        <strong>${escapeHtml(tab.risk)}</strong>
      </div>
    </section>
  `;
}

function renderWalletPanel() {
  const connected = state.wallet.status === "connected";

  return `
    <section class="wallet-panel ${connected ? "is-connected" : ""}" aria-label="Wallet session">
      <div>
        <span class="panel-kicker">identity</span>
        <h2>${connected ? "wallet connected" : "connect wallet to start"}</h2>
      </div>
      <p>${escapeHtml(connected ? `${state.wallet.address} · ${state.wallet.profileId}` : state.authNotice)}</p>
      <div class="wallet-actions">
        ${connected ? `
          <button type="button" data-wallet-action="copy">copy address</button>
          <button type="button" data-wallet-action="session">session</button>
        ` : `
          <button type="button" data-wallet-action="connect">connect wallet</button>
          <button type="button" data-wallet-action="demo">demo mode</button>
        `}
      </div>
    </section>
  `;
}

function renderTabs() {
  return `
    <nav class="agent-tabs" aria-label="Agent tabs">
      ${agentTabs.map((tab) => `
        <button class="agent-tab ${tab.id === state.activeTabId ? "is-active" : ""}" type="button" data-tab-id="${tab.id}">
          <span class="agent-tab__top">
            <strong>${escapeHtml(tab.agent)}</strong>
            <em class="${statusTone(tab.status)}">${escapeHtml(tab.status)}</em>
          </span>
          <span class="agent-tab__mode">${escapeHtml(tab.mode)} · ${escapeHtml(tab.runtime)}</span>
          <span class="agent-tab__repo">${escapeHtml(tab.repo)} / ${escapeHtml(tab.branch)}</span>
          <span class="agent-tab__summary">${escapeHtml(tab.summary)}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderViewNav() {
  return `
    <nav class="view-nav" aria-label="Workspace views">
      ${views.map(([id, label]) => `
        <button class="${state.activeView === id ? "is-active" : ""}" type="button" data-view="${id}">
          ${escapeHtml(label)}
        </button>
      `).join("")}
    </nav>
  `;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `request failed with ${response.status}`);
  }
  return data;
}

function walletAddressFixture() {
  return state.wallet.address || "0x8f2c8d7e7d0d8f2c8d7e7d0d8f2c8d7e7d0d8f2c";
}

function selectedProject() {
  return projects.find((project) => project.id === state.selectedProjectId) || projects[0];
}

function activeGoalRun() {
  return state.goalRuns.find((run) => run.id === state.goalRunId) || state.goalRuns[0] || null;
}

function persistState() {
  localStorage.setItem(storageKey, JSON.stringify({
    wallet: state.wallet,
    authNotice: state.authNotice,
    goalRunId: state.goalRunId,
    goalNotice: state.goalNotice,
    pairing: state.pairing,
    selectedProjectId: state.selectedProjectId,
    selectedModel: state.selectedModel
  }));
}

function hydrateState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    if (saved.wallet) state.wallet = { ...state.wallet, ...saved.wallet };
    if (saved.authNotice) state.authNotice = saved.authNotice;
    if (saved.goalRunId) state.goalRunId = saved.goalRunId;
    if (saved.goalNotice) state.goalNotice = saved.goalNotice;
    if (saved.pairing) state.pairing = { ...state.pairing, ...saved.pairing };
    if (saved.selectedProjectId) state.selectedProjectId = saved.selectedProjectId;
    if (saved.selectedModel) state.selectedModel = saved.selectedModel;
  } catch {
    localStorage.removeItem(storageKey);
  }
}

async function syncServerState() {
  const requests = [
    fetchJson(`${authServerBase}/machines`).catch(() => ({ machines: [] })),
    fetchJson(`${authServerBase}/goals`).catch(() => ({ runs: [] })),
    fetchJson(`${authServerBase}/mpp/offers`).catch(() => ({ actions: [] }))
  ];

  if (state.wallet.sessionToken) {
    requests.push(fetchJson(`${authServerBase}/auth/session?token=${encodeURIComponent(state.wallet.sessionToken)}`).catch(() => null));
  } else {
    requests.push(Promise.resolve(null));
  }

  if (state.pairing.code) {
    requests.push(fetchJson(`${authServerBase}/pairing/${encodeURIComponent(state.pairing.code)}`).catch(() => null));
  } else {
    requests.push(Promise.resolve(null));
  }

  const [machinesResponse, goalsResponse, offersResponse, sessionResponse, pairingResponse] = await Promise.all(requests);

  state.machines = machinesResponse.machines || [];
  state.goalRuns = goalsResponse.runs || [];
  state.availableOffers = offersResponse.actions || [];

  const run = activeGoalRun();
  if (run) {
    state.goalRunId = run.id;
    state.goalCheckpoints = run.checkpoints || [];
    state.goalNotice = `${run.id} running · checkpoints every ${run.checkpointIntervalMinutes}m`;
  }

  if (sessionResponse?.session) {
    state.wallet = {
      ...state.wallet,
      status: "connected",
      address: sessionResponse.session.address || state.wallet.address,
      profileId: sessionResponse.session.profileId || state.wallet.profileId
    };
  }

  if (pairingResponse?.pairing) {
    state.pairing = {
      ...state.pairing,
      status: pairingResponse.pairing.status,
      code: pairingResponse.pairing.code,
      command: pairingResponse.pairing.command,
      notice: pairingResponse.pairing.status === "online"
        ? `${pairingResponse.pairing.machineName} connected`
        : `expires ${new Date(pairingResponse.pairing.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    };
  }

  persistState();
  render();
}

function startSyncLoop() {
  if (syncTimer) window.clearInterval(syncTimer);
  syncServerState().catch(() => {});
  syncTimer = window.setInterval(() => {
    syncServerState().catch(() => {});
  }, 5000);
}

async function connectWallet() {
  state.authNotice = "requesting wallet signature...";
  render();

  try {
    let address = walletAddressFixture();
    let signature = "";
    let message = "";
    let sessionToken = "";
    let profileId = "";

    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      address = accounts?.[0] || address;
      const nonceResponse = await fetchJson(`${authServerBase}/auth/nonce?address=${encodeURIComponent(address)}`);
      message = nonceResponse.message;
      signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, address]
      });
      const verifyResponse = await fetchJson(`${authServerBase}/auth/verify`, {
        method: "POST",
        body: JSON.stringify({
          address,
          message,
          nonce: nonceResponse.nonce,
          signature
        })
      });
      sessionToken = verifyResponse.sessionToken;
      profileId = verifyResponse.profileId;
    } else {
      profileId = `profile_${address.toLowerCase().slice(2, 10)}`;
      sessionToken = `demo_${crypto.randomUUID()}`;
    }

    state.wallet = {
      status: "connected",
      address,
      sessionToken,
      profileId,
      mode: window.ethereum ? "real" : "demo"
    };
    state.activeView = "setup";
    state.authNotice = window.ethereum ? "wallet session verified" : "demo wallet session ready";
  } catch (error) {
    state.wallet = {
      status: "disconnected",
      address: "",
      sessionToken: "",
      profileId: "",
      mode: "wallet"
    };
    state.authNotice = error instanceof Error ? error.message : "wallet login failed";
  }

  persistState();
  startSyncLoop();
  render();
}

function connectDemoWallet() {
  const address = walletAddressFixture();
  state.wallet = {
    status: "connected",
    address,
    sessionToken: `demo_${crypto.randomUUID()}`,
    profileId: `profile_${address.toLowerCase().slice(2, 10)}`,
    mode: "demo"
  };
  state.authNotice = "demo wallet session ready";
  state.activeView = "setup";
  persistState();
  startSyncLoop();
  render();
}

async function startPairing() {
  state.pairing = {
    ...state.pairing,
    status: "pairing",
    notice: "creating daemon pairing code..."
  };
  render();

  try {
    const response = await fetchJson(`${authServerBase}/pairing/start`, {
      method: "POST",
      body: JSON.stringify({
        profileId: state.wallet.profileId || "profile_demo",
        machineName: selectedProject().machine
      })
    });

    state.pairing = {
      status: response.pairing.status,
      code: response.pairing.code,
      command: response.pairing.command,
      notice: `expires ${new Date(response.pairing.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    };
  } catch (error) {
    const code = crypto.randomUUID().split("-")[0].toUpperCase();
    state.pairing = {
      status: "pairing",
      code,
      command: `noecho pair ${code}`,
      notice: error instanceof Error ? `local pairing fallback · ${error.message}` : "local pairing fallback"
    };
  }

  persistState();
  render();
}

function markPaired() {
  const project = selectedProject();
  state.pairing = {
    ...state.pairing,
    status: "online",
    notice: `${project.machine} connected · daemon v0.4.1`
  };
  state.activeView = "terminal";
  persistState();
  render();
}

async function startGoalRun() {
  if (state.wallet.status !== "connected") {
    state.goalNotice = "connect wallet or demo mode before starting /goal";
    state.activeView = "goal";
    render();
    return;
  }

  state.goalNotice = "starting codex /goal...";
  render();

  try {
    const response = await fetchJson(`${authServerBase}/goals`, {
      method: "POST",
      body: JSON.stringify({
        tabId: "codex-goal",
        agent: "codex",
        prompt: "make mobile cockpit production ready",
        runtimeBudgetMinutes: 540,
        spendBudgetUsd: 15,
        checkpointIntervalMinutes: 30
      })
    });
    state.goalRunId = response.run.id;
    state.goalRuns = [response.run, ...(state.goalRuns || [])];
    state.goalCheckpoints = response.checkpoints || [];
    state.goalNotice = `${response.run.id} running · checkpoints every 30m`;
  } catch (error) {
    state.goalRunId = `local_${crypto.randomUUID().split("-")[0]}`;
    state.goalNotice = error instanceof Error ? `local fallback · ${error.message}` : "local fallback goal started";
  }

  persistState();
  render();
}

function renderTerminal(tab) {
  const lines = terminalLines[tab.id] || terminalLines["codex-goal"];
  return `
    <section class="panel terminal-panel" aria-label="Terminal">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">live terminal</span>
          <h2>${escapeHtml(tab.repo)}</h2>
        </div>
        <button class="mini-btn" type="button" data-view="approvals">approvals ${approvals.length}</button>
      </div>
      <div class="status-rail" aria-label="Agent status">
        <span>heard</span>
        <span>planned</span>
        <span>edited</span>
        <span>tested</span>
        <span class="is-hot">${escapeHtml(tab.status)}</span>
      </div>
      <div class="terminal-window" role="log" aria-label="Terminal output">
        ${lines.map(([tone, line]) => `<div class="term-line ${tone}">${escapeHtml(line)}</div>`).join("")}
      </div>
      <div class="command-bar">
        <span>$</span>
        <input value="${state.recording ? "continue fixing, but ask before push" : ""}" placeholder="type or hold mic to speak">
        <button type="button">send</button>
      </div>
    </section>
  `;
}

function renderPrompts() {
  return `
    <section class="panel" aria-label="Prompt library">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">command deck</span>
          <h2>prompt library</h2>
        </div>
        <button class="mini-btn" type="button">new macro</button>
      </div>
      <div class="prompt-grid">
        ${prompts.map((prompt) => `
          <button class="prompt-row" type="button">
            <span>
              <strong>${escapeHtml(prompt.title)}</strong>
              <em>${escapeHtml(prompt.phrase)}</em>
            </span>
            <span>
              <b>${escapeHtml(prompt.lane)}</b>
              <small>${escapeHtml(prompt.price)} · ${escapeHtml(prompt.risk)}</small>
            </span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSetup() {
  const project = selectedProject();
  const paired = state.pairing.status === "online";
  const machineRows = state.machines.length
    ? state.machines.map((machine) => `
      <div class="machine-row">
        <strong>${escapeHtml(machine.name)}</strong>
        <small>${escapeHtml(machine.status)}</small>
      </div>
    `).join("")
    : `<div class="machine-row"><strong>no machine yet</strong><small>waiting</small></div>`;

  return `
    <section class="panel setup-panel" aria-label="Setup">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">daemon setup</span>
          <h2>${escapeHtml(project.path)} · ${escapeHtml(project.branch)}</h2>
        </div>
        <button class="mini-btn" type="button" data-setup-action="pair">${paired ? "paired" : "pair"}</button>
      </div>
      <div class="model-toggle" aria-label="Model toggle">
        ${["codex", "claude", "gpt"].map((model) => `
          <button class="${state.selectedModel === model ? `is-active ${model}` : ""}" type="button" data-model="${model}">
            ${escapeHtml(model)}
          </button>
        `).join("")}
      </div>
      <div class="setup-grid">
        <article class="setup-card">
          <span class="section-label">1 · run daemon</span>
          <code>$ npm i -g noecho<br>$ ${escapeHtml(state.pairing.command)}</code>
          <p>${escapeHtml(state.pairing.notice)}</p>
          <div class="pairing-code">${state.pairing.code ? escapeHtml(state.pairing.code) : "tap pair"}</div>
          <div class="machine-list">${machineRows}</div>
          <button type="button" data-setup-action="${paired ? "terminal" : "paired"}">
            ${paired ? "open terminal" : "simulate daemon online"}
          </button>
        </article>
        <article class="setup-card">
          <span class="section-label">2 · byok</span>
          <div class="key-list">
            ${byokKeys.map((key) => `
              <div>
                <span class="${escapeHtml(key.tone)}"></span>
                <strong>${escapeHtml(key.label)}</strong>
                <em>${escapeHtml(key.hint)}</em>
                <code>${escapeHtml(key.value)}</code>
              </div>
            `).join("")}
          </div>
        </article>
        <article class="setup-card">
          <span class="section-label">3 · project</span>
          <div class="project-list">
            ${projects.map((item) => `
              <button class="${item.id === state.selectedProjectId ? "is-active" : ""}" type="button" data-project-id="${escapeHtml(item.id)}">
                <span>
                  <strong>${escapeHtml(item.name)}</strong>
                  <em>${escapeHtml(item.path)} · ${escapeHtml(item.branch)}</em>
                </span>
                <small>${escapeHtml(item.machine)}</small>
              </button>
            `).join("")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderGoal() {
  const run = activeGoalRun();
  const hasRun = Boolean(run);
  const checkpointsToShow = state.goalCheckpoints.length
    ? state.goalCheckpoints.map((checkpoint) => ({
      time: new Date(checkpoint.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      title: checkpoint.label,
      detail: checkpoint.detail
    }))
    : checkpoints;
  const runtimeLabel = run ? `${Math.max(1, Math.round(run.runtimeBudgetMinutes / 60))}h target` : "3h 12m / 9h";
  const budgetLabel = run ? `$0.00 / $${run.spendBudgetUsd}` : "$2.18 / $15";

  return `
    <section class="panel" aria-label="Goal run">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">long run</span>
          <h2>/goal production-ready mobile cockpit</h2>
        </div>
        <button class="mini-btn ${hasRun ? "danger" : ""}" type="button" data-goal-action="${hasRun ? "pause" : "start"}">
          ${hasRun ? "pause" : "start 9h"}
        </button>
      </div>
      <p class="goal-notice">${escapeHtml(state.goalNotice)}</p>
      <div class="goal-meter">
        <div>
          <span>runtime</span>
          <strong>${escapeHtml(runtimeLabel)}</strong>
        </div>
        <div>
          <span>budget</span>
          <strong>${escapeHtml(budgetLabel)}</strong>
        </div>
      </div>
      <div class="progress"><span style="width:36%"></span></div>
      <div class="checkpoint-list">
        ${checkpointsToShow.map((checkpoint) => `
          <article>
            <time>${escapeHtml(checkpoint.time)}</time>
            <div>
              <strong>${escapeHtml(checkpoint.title)}</strong>
              <p>${escapeHtml(checkpoint.detail)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderApprovals() {
  return `
    <section class="panel" aria-label="Approval inbox">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">risk gates</span>
          <h2>approval inbox</h2>
        </div>
        <button class="mini-btn danger" type="button">panic stop</button>
      </div>
      <div class="approval-list">
        ${approvals.map((approval) => `
          <article class="approval-card">
            <div class="approval-card__meta">
              <span>${escapeHtml(approval.tab)}</span>
              <span>${escapeHtml(approval.risk)} · ${escapeHtml(approval.amount)}</span>
            </div>
            <h3>${escapeHtml(approval.title)}</h3>
            <p>${escapeHtml(approval.detail)}</p>
            <div class="approval-actions">
              <button type="button">approve</button>
              <button type="button">edit</button>
              <button type="button">reject</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderHistory() {
  return `
    <section class="panel" aria-label="History">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">sessions</span>
          <h2>history</h2>
        </div>
        <button class="mini-btn" type="button">search</button>
      </div>
      <div class="list-stack">
        ${history.map((item) => `
          <article>
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.repo)}</span>
            <small>${escapeHtml(item.meta)}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSpend() {
  const offers = state.availableOffers.length
    ? state.availableOffers.map((offer) => `
      <article>
        <strong>${escapeHtml(offer.title)}</strong>
        <span>${escapeHtml(offer.intent)} · ${escapeHtml(offer.method)}</span>
        <small>$${escapeHtml(offer.amount)}</small>
      </article>
    `).join("")
    : receipts.map((receipt) => `
      <article>
        <strong>${escapeHtml(receipt.label)}</strong>
        <span>${escapeHtml(receipt.detail)}</span>
        <small>${escapeHtml(receipt.amount)}</small>
      </article>
    `).join("");

  return `
    <section class="panel" aria-label="Spend">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">wallet + mpp</span>
          <h2>spend</h2>
        </div>
        <button class="mini-btn" type="button">top up</button>
      </div>
      <div class="spend-grid">
        <div><span>balance</span><strong>$12.82</strong></div>
        <div><span>goal cap</span><strong>$15.00</strong></div>
        <div><span>hour cap</span><strong>$4.00</strong></div>
      </div>
      <div class="list-stack">
        ${offers}
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="panel" aria-label="Settings">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">control center</span>
          <h2>settings</h2>
        </div>
        <button class="mini-btn" type="button">export</button>
      </div>
      <div class="settings-list">
        ${settings.map(([label, value]) => `
          <button type="button">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </button>
        `).join("")}
        <button type="button" data-view="setup">
          <span>setup</span>
          <strong>daemon, BYOK, projects</strong>
        </button>
      </div>
    </section>
  `;
}

function renderWorkspace(tab) {
  const walletConnected = state.wallet.status === "connected";

  if (!walletConnected && state.activeView !== "settings" && state.activeView !== "setup" && state.activeView !== "goal") {
    return state.activeView === "spend" ? renderSpend() : renderTerminal(tab);
  }

  if (state.activeView === "prompts") return renderPrompts();
  if (state.activeView === "setup") return renderSetup();
  if (state.activeView === "goal") return renderGoal();
  if (state.activeView === "approvals") return renderApprovals();
  if (state.activeView === "history") return renderHistory();
  if (state.activeView === "spend") return renderSpend();
  if (state.activeView === "settings") return renderSettings();
  return renderTerminal(tab);
}

function renderVoice() {
  return `
    <div class="voice-dock ${state.recording ? "is-recording" : ""}">
      ${state.recording ? `<div class="transcript">"continue fixing, but ask before push"</div>` : ""}
      <button class="voice" type="button" aria-label="Voice command" data-voice>
        <span></span>
      </button>
    </div>
  `;
}

function render() {
  const tab = activeTab();
  document.querySelector("#app").innerHTML = `
    <section class="phone">
      ${renderHeader(tab)}
      ${renderWalletPanel()}
      ${renderTabs()}
      ${renderViewNav()}
      <main class="workspace">
        ${renderWorkspace(tab)}
      </main>
      ${renderVoice()}
    </section>
  `;
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-tab-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTabId = button.dataset.tabId;
      state.activeView = "terminal";
      render();
    });
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      render();
    });
  });

  document.querySelector("[data-voice]")?.addEventListener("click", () => {
    state.recording = !state.recording;
    render();
  });

  document.querySelectorAll("[data-wallet-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.walletAction;
      if (action === "connect") {
        connectWallet();
      } else if (action === "demo") {
        connectDemoWallet();
      } else if (action === "copy" && state.wallet.address) {
        navigator.clipboard?.writeText(state.wallet.address).catch(() => {});
      } else if (action === "session" && state.wallet.sessionToken) {
        state.authNotice = `session ${state.wallet.sessionToken.slice(0, 8)}...`;
        persistState();
        render();
      }
    });
  });

  document.querySelectorAll("[data-goal-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.goalAction;
      if (action === "start") {
        startGoalRun();
      } else if (action === "pause") {
        state.goalNotice = `${state.goalRunId} pause requested`;
        persistState();
        render();
      }
    });
  });

  document.querySelectorAll("[data-setup-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.setupAction;
      if (action === "pair") {
        startPairing();
      } else if (action === "paired") {
        markPaired();
      } else if (action === "terminal") {
        state.activeView = "terminal";
        render();
      }
    });
  });

  document.querySelectorAll("[data-project-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedProjectId = button.dataset.projectId;
      persistState();
      render();
    });
  });

  document.querySelectorAll("[data-model]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedModel = button.dataset.model;
      persistState();
      render();
    });
  });
}

hydrateState();
render();
startSyncLoop();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
