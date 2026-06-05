import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kyselyIndex = path.join(
  __dirname,
  "..",
  "node_modules",
  "better-auth",
  "node_modules",
  "kysely",
  "dist",
  "index.js"
);

if (!fs.existsSync(kyselyIndex)) {
  console.log("patch-kysely: no nested kysely found, skipping.");
  process.exit(0);
}

const content = fs.readFileSync(kyselyIndex, "utf8");
if (content.includes("DEFAULT_MIGRATION_TABLE")) {
  console.log("patch-kysely: already patched, skipping.");
  process.exit(0);
}

const patch = `
// Compatibility shim — removed from kysely ≥0.28 public API but still used by @better-auth/kysely-adapter
export const DEFAULT_MIGRATION_TABLE = "kysely_migration";
export const DEFAULT_MIGRATION_LOCK_TABLE = "kysely_migration_lock";
`;

fs.writeFileSync(kyselyIndex, content + patch);
console.log("patch-kysely: patched DEFAULT_MIGRATION_TABLE into better-auth/node_modules/kysely.");
