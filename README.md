# Noecho

Phone cockpit for long-running coding agents.

Noecho pairs a mobile PWA with a user's laptop or VPS, then lets them control Claude Code, Codex, OpenCode, and shell sessions with voice, terminal tabs, prompt macros, approvals, wallet identity, MPP payments, and long `/goal` runs.

This repo is the early Noecho MVP. Older Noecho/vibecode attempts are intentionally ignored. The only design references for this build are:

- Keywitness Noecho UI reference: `public/ui-assets/noecho-ui.html`
- Keywitness Noecho demo reference: `src/NoechoDemo.jsx`
- The current product planning session

## Repo Layout

```txt
apps/
  web/      phone PWA shell
  daemon/   local/VPS agent controller CLI
  server/   self-hosted API and websocket server
packages/
  protocol/ shared event and command types
  agents/   agent adapter contracts
  prompts/  starter prompt library
  db/       database table constants and migration notes
supabase/   hosted beta migrations
docker/     self-hosted compose files
docs/       build plan and process notes
```

## First Commands

```sh
npm install
npm run typecheck
npm run build
npm run test
npm run dev:web
```

The repo is dependency-light on purpose. The first scripts validate structure and package metadata without requiring network installs.

## Local MVP Flow

Start the API:

```sh
npm --workspace @noecho/server run dev
```

Start the PWA:

```sh
npm run dev:web
```

Open the PWA, connect a wallet or use local demo mode, then pair the daemon:

```sh
node apps/daemon/src/cli.mjs pair <CODE> --server http://127.0.0.1:4010
```

Claim terminal commands:

```sh
node apps/daemon/src/cli.mjs dispatch loop --server http://127.0.0.1:4010 --tab shell-local
```

Claim model-room work:

```sh
node apps/daemon/src/cli.mjs room loop --server http://127.0.0.1:4010 --room <ROOM_ID> --agents codex,claude
```

By default, room agents are simulated. Set `NOECHO_EXECUTE_AGENTS=true` on the daemon to call local `codex exec` and `claude -p`.

## Current Scope

Implemented:

- Monorepo structure.
- Phone PWA shell with wallet login, agent tabs, terminal, prompt library, setup, approvals, spend, and settings.
- Daemon CLI with pairing and local `/goal` state.
- Self-hosted server with wallet auth, pairing, goals, checkpoints, and MPP discovery boundary.
- Shared protocol schemas.
- Supabase starter migration.
- Docker Compose starter.
- Brief process docs.
- Full chat-style model room with Codex/Claude participants and approval-gated agent actions.

Next:

- Move hosted state from snapshot mirror to first-class Supabase rows.
- Add QR rendering and live daemon sync.
- Harden and package the real Codex/Claude daemon adapters.
