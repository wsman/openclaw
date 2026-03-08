#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const sourcePath = path.join(
  repoRoot,
  "vendor/negentropy-lab/server/gateway/openclaw-decision/contracts/decision-contract.ts",
);
const targetPath = path.join(repoRoot, "extensions/negentropy-lab/src/decision-contract.snapshot.ts");

const header = `/**
 * AUTO-GENERATED FILE — DO NOT HAND-EDIT.
 *
 * Canonical source:
 *   vendor/negentropy-lab/server/gateway/openclaw-decision/contracts/decision-contract.ts
 *
 * Sync command:
 *   node extensions/negentropy-lab/scripts/sync-decision-contract-snapshot.mjs
 */\n\n`;

async function main() {
  const source = await fs.readFile(sourcePath, "utf8");
  const normalizedSource = source.replace(/^\uFEFF/, "");
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${header}${normalizedSource.trimEnd()}\n`, "utf8");
  console.log(`Synced decision contract snapshot -> ${path.relative(repoRoot, targetPath)}`);
}

main().catch((error) => {
  console.error(
    `[sync-decision-contract-snapshot] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
