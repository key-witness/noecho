# Noecho

Phone cockpit for long-running coding agents.

Noecho pairs a mobile PWA with a user's laptop or VPS, then lets them control Claude Code, Codex, OpenCode, and shell sessions with voice, terminal tabs, prompt macros, approvals, wallet identity, MPP payments, and long `/goal` runs.

This repo is a fresh product scaffold. Older Noecho/vibecode attempts are intentionally ignored. The only design references for this build are:

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

The scaffold is dependency-light on purpose. The first scripts validate structure and package metadata without requiring network installs. Framework dependencies land in later implementation steps.

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

Next:

- Wire persistent Supabase auth/session storage.
- Add QR rendering and live daemon sync.
- Spawn real Codex/Claude/OpenCode adapters behind approval gates.
