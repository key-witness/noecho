const tabs = [
  { agent: "codex", mode: "/goal", repo: "noecho/main", status: "running", spend: "$0.00" },
  { agent: "claude", mode: "review", repo: "noecho/ui", status: "idle", spend: "$0.00" },
  { agent: "shell", mode: "terminal", repo: "local", status: "paired", spend: "free" }
];

const events = [
  "wallet pending - connect to start",
  "machine pairing - scan QR from noecho pair",
  "next step - implement real PWA shell",
  "goal mode - daemon will own long runs"
];

function renderTabs() {
  return tabs.map((tab) => `
    <button class="agent-tab" type="button">
      <span class="agent-tab__name">${tab.agent}</span>
      <span class="agent-tab__meta">${tab.mode}</span>
      <span class="agent-tab__repo">${tab.repo}</span>
      <span class="agent-tab__status">${tab.status} · ${tab.spend}</span>
    </button>
  `).join("");
}

function renderEvents() {
  return events.map((event) => `<li>${event}</li>`).join("");
}

document.querySelector("#app").innerHTML = `
  <section class="phone">
    <header class="topbar">
      <div>
        <p class="eyebrow">fresh scaffold</p>
        <h1>noecho</h1>
      </div>
      <button class="wallet" type="button">wallet</button>
    </header>

    <nav class="tabs" aria-label="Agent tabs">
      ${renderTabs()}
    </nav>

    <section class="terminal" aria-label="Terminal preview">
      <div class="terminal__bar">
        <span>codex /goal</span>
        <span>9h budget ready</span>
      </div>
      <pre><code>$ noecho pair
scan QR from phone

$ noecho goal start "make the app shippable"
waiting for wallet session and machine approval...</code></pre>
    </section>

    <section class="deck" aria-label="Prompt deck">
      <button type="button">fix build</button>
      <button type="button">audit contract</button>
      <button type="button">ship preview</button>
      <button type="button">pause all</button>
    </section>

    <section class="events" aria-label="Scaffold events">
      <h2>process</h2>
      <ul>${renderEvents()}</ul>
    </section>

    <button class="voice" type="button" aria-label="Voice command">
      <span></span>
    </button>
  </section>
`;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
