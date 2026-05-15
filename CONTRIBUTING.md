# Contributing

Noecho is a small npm workspace. Keep changes focused and dependency-light unless the feature needs a real framework or runtime.

## Local Checks

```sh
npm install
npm run build
npm test
```

## Development Loop

Run the API:

```sh
npm --workspace @noecho/server run dev
```

Run the PWA:

```sh
npm run dev:web
```

Pair the daemon:

```sh
node apps/daemon/src/cli.mjs pair <CODE> --server http://127.0.0.1:4010
```

Claim shell commands:

```sh
node apps/daemon/src/cli.mjs dispatch loop --server http://127.0.0.1:4010 --tab shell-local
```

Claim model-room work:

```sh
node apps/daemon/src/cli.mjs room loop --server http://127.0.0.1:4010 --room <ROOM_ID> --agents codex,claude
```

## Pull Requests

- Include the user journey affected by the change.
- Keep hosted defaults secure.
- Add or update docs when setup, envs, routes, or daemon behavior changes.
