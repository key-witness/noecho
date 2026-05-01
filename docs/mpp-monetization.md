# MPP Monetization

Noecho uses MPP as a discovery and payment layer for hosted actions while keeping local/self-hosted use free by default.

## Local Defaults

- `NOECHO_MPP_ENABLED` defaults to off.
- Paid endpoints return dev-mode success when MPP is off.
- When `NOECHO_MPP_ENABLED=true`, paid endpoints return HTTP `402` unless the request includes an `x-mpp-receipt` header.
- Real receipt validation is intentionally left behind this boundary so the first hosted beta can choose the exact MPP SDK and settlement method without reshaping the product API.

## Discovery

- `GET /openapi.json` exposes paid actions with `x-payment-info`.
- `GET /mpp/offers` returns Noecho's paid action catalog.
- `GET /.well-known/mpp.json` mirrors the same catalog for simple crawlers and agent clients.

## Initial Paid Actions

- `POST /paid/prompt-pack/vibe`: small prompt pack purchase.
- `POST /paid/goal-session`: hosted Codex `/goal` budget session.
- `POST /paid/contract-audit`: crypto audit helper scan.

## Launch Policy

Start on Vercel and Supabase free tiers with MPP disabled for self-hosted installs. Enable MPP only on the hosted beta once wallet login, receipts, and spend caps are visible in the PWA.
