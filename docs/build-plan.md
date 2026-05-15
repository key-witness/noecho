# Build Plan

This repo follows the Noecho product plan from the Keywitness planning session.

## Phase 1 - Scaffold

Status: complete.

- Create a clean product repo.
- Add app and package workspaces.
- Add PWA, daemon, server, Supabase, Docker, and docs placeholders.
- Initialize git.
- Verify baseline scripts.

## Phase 2 - Phone PWA Shell

Status: first mock implemented.

- Replace the static scaffold with the real mobile cockpit.
- Implement agent tabs, terminal panel, prompt deck, approvals, history, spend, settings, and `/goal` screens with mocked data.

## Phase 3 - Protocol

Status: complete.

- Add zod schemas for machines, tabs, events, prompts, approvals, goals, spend limits, and MPP receipts.

## Phase 4 - Hosted Beta

Status: migration, local pairing API, and standalone hosted plan complete.

- Add Supabase wallet profiles, QR pairing, daemon sync, model rooms, and event streaming.
- Keep Vercel/Supabase free-tier usage lean.
- Keep paid MPP actions feature-flagged until commercial hosting is ready.

## Phase 5 - Wallet Login

Status: implemented for local beta.

- Add wallet-first nonce/signature verification.
- Keep demo mode available for users without an injected wallet.
- Store the verified wallet session in the phone cockpit state until Supabase auth is wired.

## Phase 6 - Daemon And Goal Mode

Status: local foundation, setup flow, phone sync, live terminal feed, and model-room work queue in progress.

- Implement local/VPS daemon.
- Add Claude, Codex, and shell adapters.
- Implement long-running `/goal` with checkpoints, approvals, and phone disconnect tolerance.

## Phase 6.5 - Multiplayer Model Rooms

Status: first polling-based MVP implemented.

- Add full chat-style rooms with user, Codex, and Claude participants.
- Broadcast user prompts as high-priority daemon work.
- Let daemon agents post room messages and create approval requests for risky actions.

## Phase 7 - MPP Monetization

Status: discovery and 402 boundary implemented.

- Add MPP-protected endpoints for hosted transcription, prompt packs, reviews, scans, deploy assist, and goal budgets.
- Store receipts and expose spend controls.

## Phase 8 - Self-Hosted Edition

- Make the Docker server path work without Supabase.
- Allow MPP to be disabled or configured by the self-hosted operator.
