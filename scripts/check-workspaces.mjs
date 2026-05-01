import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const mode = process.argv[2] || "check";
const root = process.cwd();

const requiredPaths = [
  "apps/web/package.json",
  "apps/web/index.html",
  "apps/web/src/main.js",
  "apps/web/src/styles.css",
  "apps/web/public/manifest.webmanifest",
  "apps/daemon/package.json",
  "apps/daemon/src/cli.mjs",
  "apps/server/package.json",
  "apps/server/src/server.mjs",
  "packages/protocol/package.json",
  "packages/protocol/src/index.ts",
  "packages/agents/package.json",
  "packages/agents/src/index.ts",
  "packages/prompts/package.json",
  "packages/prompts/src/index.ts",
  "packages/db/package.json",
  "packages/db/src/index.ts",
  "supabase/migrations/0001_initial.sql",
  "docker/docker-compose.yml",
  "docs/build-plan.md",
  "docs/process-log.md",
  "docs/references.md"
];

const requiredPackages = [
  "apps/web",
  "apps/daemon",
  "apps/server",
  "packages/protocol",
  "packages/agents",
  "packages/prompts",
  "packages/db"
];

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

const missing = requiredPaths.filter((path) => !existsSync(join(root, path)));

if (missing.length > 0) {
  console.error(`noecho ${mode}: missing required scaffold files:`);
  for (const path of missing) console.error(`- ${path}`);
  process.exit(1);
}

for (const workspace of requiredPackages) {
  const pkg = readJson(`${workspace}/package.json`);
  if (!pkg.name || !pkg.version || !pkg.type) {
    console.error(`noecho ${mode}: invalid package metadata in ${workspace}/package.json`);
    process.exit(1);
  }
}

const rootPkg = readJson("package.json");
if (!Array.isArray(rootPkg.workspaces) || rootPkg.workspaces.length === 0) {
  console.error("noecho check: root package.json must define workspaces");
  process.exit(1);
}

console.log(`noecho ${mode}: scaffold ok`);
