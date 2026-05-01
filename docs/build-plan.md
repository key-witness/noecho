# Build Plan

This repo follows the Noecho product plan from the Keywitness planning session.

## Phase 1 - Scaffold

Status: in progress.

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

Status: in progress.

- Add zod schemas for machines, tabs, events, prompts, approvals, goals, spend limits, and MPP receipts.

## Phase 4 - Hosted Beta

Status: in progress.

- Add Supabase wallet profiles, QR pairing, daemon sync, and event streaming.
- Keep Vercel/Supabase free-tier usage lean.
- Keep paid MPP actions feature-flagged until commercial hosting is ready.

## Phase 5 - Daemon And Goal Mode

- Implement local/VPS daemon.
- Add Claude Code, Codex, OpenCode, and shell adapters.
- Implement long-running `/goal` with checkpoints, approvals, and phone disconnect tolerance.

## Phase 6 - MPP Monetization

- Add MPP-protected endpoints for hosted transcription, prompt packs, reviews, scans, deploy assist, and goal budgets.
- Store receipts and expose spend controls.

## Phase 7 - Self-Hosted Edition

- Make the Docker server path work without Supabase.
- Allow MPP to be disabled or configured by the self-hosted operator.
