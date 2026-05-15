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

## 2026-05-02 - Step 11 Phone Command Dispatch

Implementation notes:

- Added server-side command queue routes so the phone terminal can dispatch work into a live tab.
- Added daemon CLI dispatch polling and local shell execution with command completion streamed back into the terminal feed.
- Bound the existing phone command bar to the live dispatch route while preserving the current black-blue cockpit styling.

## 2026-05-06 - Step 12 Server Persistence

Implementation notes:

- Added local file persistence for sessions, pairing codes, machines, tabs, terminal chunks, approvals, goal runs, goal checkpoints, and command dispatches.
- Rehydrated the server from `.noecho/server-state.json` on boot so the phone cockpit survives API restarts.
- Verified the goal flow, daemon dispatch, and terminal feed still work after a full server restart.

## 2026-05-06 - Step 13 Supabase Snapshot Mirror

Implementation notes:

- Added an optional Supabase snapshot mirror for the full server state with hosted profile bindings for wallet auth.
- Added a hosted snapshot table and kept the local file snapshot as the reliable fallback.
- Preserved the existing phone cockpit flow while making auth and persistence ready for hosted beta deployment.

## 2026-05-08 - Step 14 Hosted Supabase Verification

Implementation notes:

- Confirmed the existing Keywitness Supabase project `byavvkwqfdiukemforsy` is linked and reachable from the Noecho repo.
- Repaired the remote migration history enough to unblock direct schema work, then created the hosted profile, wallet identity, and snapshot tables the server needs.
- Verified the wallet auth flow against a temporary hosted-enabled API and confirmed hosted profile writes and snapshot reads round-trip through Supabase.

## 2026-05-08 - Step 15 Hosted Schema Completion

Implementation notes:

- Added the remaining Noecho hosted tables and RLS scaffolding to the existing Keywitness Supabase project.
- Confirmed the remote schema now contains the full Noecho set: profiles, wallet identities, machines, agent tabs, events, goals, checkpoints, terminal chunks, approvals, prompt macros, spend limits, donations, repo connections, receipts, and hosted state snapshots.
- Kept the local file snapshot fallback and the hosted snapshot mirror intact so the cockpit can still boot cleanly offline or against the existing shared project.

## 2026-05-08 - Step 16 Hosted End-to-End Smoke Test

Implementation notes:

- Verified the hosted snapshot mirror updated on the linked Supabase project after auth, pairing, goal creation, command dispatch, and daemon execution.
- Confirmed the terminal feed on the temporary hosted API showed the dispatched command, its stdout, and the completion event.
- Stopped the temporary API process after verification so the repo returned to a clean running state.

## 2026-05-08 - Step 17 Security Hardening

Implementation notes:

- Removed the session token from the browser URL path and switched the client to an authorization header for session lookups and write requests.
- Added server-side session checks for the browser-issued mutating routes so pairing, goals, approvals, and terminal dispatch are no longer anonymous.
- Kept the daemon bridge and demo sessions functional for local development while making the real wallet session path explicit.

## 2026-05-15 - Step 18 Hosted MVP And Model Rooms

Implementation notes:

- Added the first full chat-style model room path so users can create a room with Codex and Claude participants, broadcast user prompts at high priority, and receive agent messages.
- Added daemon room work claiming and completion routes, with risky agent actions converted into approval requests instead of immediate execution.
- Added machine tokens from pairing completion and daemon auth enforcement flags for hosted deployments.
- Added the model-room Supabase migration, protocol schemas, hosted MVP docs, and open-source repo metadata.
