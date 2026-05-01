# References

Use these references only. Ignore older local Noecho/vibecode attempts.

## UI Reference

Path:

```txt
/Users/dink/SecureDevWorkspace/2026 builds/keywitness/public/ui-assets/noecho-ui.html
```

What to preserve:

- Black phone-native terminal look.
- Claude/GPT model toggle concept.
- Voice button as the primary control.
- History, settings, projects, loading, commit, and error state coverage.
- Compact, monochrome, hacker-tool feel.

## Demo Reference

Path:

```txt
/Users/dink/SecureDevWorkspace/2026 builds/keywitness/src/NoechoDemo.jsx
```

What to preserve:

- Daemon setup story.
- API key/BYOK story.
- Project and branch selection.
- Voice recording flow.
- Terminal progress stream.
- Diff, tests, review, notification, and history flow.

## Session Decisions

- Noecho is a new product, not a continuation of old attempts.
- Core shape: phone cockpit for long-running agents.
- Keep multi-agent tabs.
- Keep a pretty terminal UI.
- Make prompt library first-class.
- Use wallet login by default.
- Keep settings clear and trust-building.
- Make `/goal` long-running autonomous Codex work a flagship feature.
- Use MPP for monetization through paid actions, sessions, prompt packs, and receipts.
- Launch free/donation beta on Vercel/Supabase free tiers, then upgrade before public paid usage.
