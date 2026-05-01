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
