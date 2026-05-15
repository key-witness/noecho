# Hosted MVP

Noecho should be deployed as its own hosted product, separate from the earlier Keywitness Supabase project used during verification.

## Target Accounts

- GitHub identity: `key-witness`
- Account email: `binkpink1@icloud.com`
- Vercel project: standalone Noecho app
- Supabase project: standalone Noecho database

## Hosted Defaults

```sh
NOECHO_ALLOW_DEMO_SESSIONS=false
NOECHO_DAEMON_AUTH_REQUIRED=true
NOECHO_WEB_ORIGIN=https://<noecho-app>
NOECHO_PUBLIC_BASE_URL=https://<noecho-api>
NOECHO_SUPABASE_URL=https://<project>.supabase.co
NOECHO_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

The phone PWA should point at the hosted API with `window.NOECHO_API_BASE` or `?api=`.

## Current MVP Loop

1. User signs in with wallet.
2. User creates a daemon pairing code.
3. Daemon completes pairing and stores a machine token.
4. User opens the room view and creates a model room with Codex and Claude.
5. User sends a prompt.
6. Daemon claims room work and posts agent replies.
7. Risky agent actions create approval requests instead of executing directly.

## Deployment Notes

The current API is a long-running Node HTTP server. It can run on a VPS, Fly, Render, Railway, or any container host. Vercel can host the static PWA now; moving the API fully into Vercel functions requires a handler refactor because `apps/server/src/server.mjs` currently owns the listener.
