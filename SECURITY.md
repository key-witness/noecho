# Security Policy

Noecho is early alpha software for controlling local coding agents from a phone.

## Supported Security Defaults

- Hosted deployments should set `NOECHO_ALLOW_DEMO_SESSIONS=false`.
- Hosted deployments should set `NOECHO_DAEMON_AUTH_REQUIRED=true`.
- Session tokens must be sent in `Authorization: Bearer ...` or `X-Noecho-Session-Token`, not in URLs.
- Daemon calls should send `X-Noecho-Machine-Token`.
- Agent execution should happen on a paired user machine unless the operator has built a separate sandbox.

## Reporting

Open a private security advisory in GitHub, or contact the repository owner directly before publishing exploit details.

## Current Known Limitations

- The table-backed Supabase implementation is in progress; local state still uses `.noecho/server-state.json`.
- The Codex and Claude daemon adapters are simulated unless `NOECHO_EXECUTE_AGENTS=true` is set.
- The hosted MPP payment path is feature-flagged and does not yet validate real receipts.
