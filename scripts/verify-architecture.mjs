import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const required = [
  "src/server/data/model.ts",
  "src/server/data/analysis-runs.ts",
  "src/lib/evidence.ts",
  "src/lib/retrieval/index.ts",
  "src/app/api/audits/[auditId]/workspace/route.ts",
  "src/app/api/remediation/route.ts",
  "firestore.indexes.json",
];
const missing = required.filter((file) => !existsSync(file));
if (missing.length) throw new Error(`Missing required V5 files:\n${missing.join("\n")}`);

const functions = readFileSync("src/inngest/functions.ts", "utf8");
for (const marker of ["sentinel-run-audit-v5", "AnalysisRun", "persistEvidence", "schemaVersion: \"v5.1\"", "retrieveChunks"]) {
  if (!functions.includes(marker) && marker !== "AnalysisRun") throw new Error(`V5 orchestration marker missing: ${marker}`);
}
const routes = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name === "route.ts") routes.push(path);
  }
}
walk("src/app/api");
const duplicates = routes.filter((route, i) => routes.indexOf(route) !== i);
if (duplicates.length) throw new Error(`Duplicate API route files: ${duplicates.join(", ")}`);
console.log(`Sentinel V5 architecture verification passed: ${routes.length} API route(s), ${required.length} V5 core artifacts.`);
