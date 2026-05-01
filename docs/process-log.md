# Process Log

## 2026-05-01 - Scaffold

Visual thesis: a pocket-sized terminal cockpit with quiet chrome, bright status, and one obvious voice control.

Content plan: wallet and pairing at the top, multi-agent tabs as navigation, terminal as trust layer, prompt deck as action surface, brief process feed for orientation.

Interaction thesis: tab switching should feel instant, terminal output should stream as the heartbeat, and the voice button should own the bottom thumb zone.

Implementation notes:

- Created a brand-new repo at `/Users/dink/SecureDevWorkspace/2026 builds/noecho`.
- Ignored older Noecho/vibecode attempts.
- Used only the Keywitness Noecho UI/demo as design references.
- Kept the scaffold dependency-light so checks run without network installs.
- Added placeholder web, daemon, server, packages, Supabase migration, Docker Compose, and docs.

## 2026-05-01 - Step 2 PWA Cockpit Mock

Visual thesis: a dense phone terminal with iTerm-like agent tabs, wallet/spend controls, and a bottom voice command dock.

Implementation notes:

- Replaced the first placeholder shell with an interactive mocked cockpit.
- Added multi-agent tabs for Codex, Claude, OpenCode, and shell.
- Added workspace views for terminal, prompts, `/goal`, approvals, history, spend, and settings.
- Kept implementation dependency-light in vanilla JS/CSS so Step 2 remains fast and easy to inspect.

## 2026-05-01 - Step 3 Protocol Schemas

Implementation notes:

- Added `zod` and defined shared schemas for wallet identities, machines, tabs, terminal chunks, approvals, prompts, goals, spend limits, and MPP receipts.
- Exported parser helpers and fixtures so future apps can share one contract layer.

## 2026-05-01 - Step 4 Supabase Hosted Beta Schema

Implementation notes:

- Added a second Supabase migration for hosted-beta tables that were missing from the scaffold.
- Added an auth ownership helper and RLS policies keyed off `profiles.auth_user_id`.
- Kept donations nullable so supporter flows can exist before full auth is wired.

## 2026-05-01 - Step 5 Wallet-First Login

Implementation notes:

- Added `viem` for EIP-191 message verification.
- Added server routes for nonce creation, signature verification, and session lookup.
- Added a wallet identity strip and connect/demo-mode flow to the PWA cockpit.

## 2026-05-01 - Step 6 Goal Mode Foundation

Implementation notes:

- Added local server endpoints for creating goal runs and appending checkpoints.
- Added a PWA `/goal` start action for a 9-hour Codex run with a $15 cap.
- Expanded the daemon CLI so self-hosted users can create, inspect, and checkpoint goal runs in local state.

## 2026-05-01 - Step 7 MPP Monetization Boundary

Implementation notes:

- Added MPP-style paid action discovery through OpenAPI and catalog endpoints.
- Added feature-flagged `402` behavior for paid actions when MPP is enabled.
- Documented the hosted/self-hosted monetization boundary.

## 2026-05-01 - Step 8 Pairing And Setup Flow

Implementation notes:

- Preserved the prototype's blue-black terminal styling and voice-first copy.
- Added local pairing endpoints and daemon completion support.
- Added the PWA setup view for daemon pairing, BYOK key state, model selection, and project/branch selection.

## 2026-05-01 - Step 9 Live Phone Sync

Implementation notes:

- Added local persistence for wallet session, pairing state, selected project, and selected model.
- Added polling for auth session, pairing, machines, goals, and MPP offers.
- Replaced more mock setup, goal, and spend values with live API-backed state.

## 2026-05-01 - Step 10 Live Terminal And Approvals Feed

Implementation notes:

- Added server-side live tab, terminal chunk, and approval stores with daemon sync endpoints.
- Added daemon CLI demo streaming so local activity can be pushed into the phone cockpit.
- Updated the PWA to read live tabs, terminal chunks, and approvals from the local server.
