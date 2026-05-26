#!/usr/bin/env node
/**
 * Clear local browser worker cooldown (safety-state.json).
 * Run while worker is stopped: npm run reset-cooldown
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const stateDir = (process.env.WORKER_STATE_DIR || "~/.contentgraph-worker/state").replace(
  /^~/,
  os.homedir(),
);
const file = path.join(stateDir, "safety-state.json");

if (!fs.existsSync(file)) {
  console.log("No safety state file (already clear):", file);
  process.exit(0);
}

let state = {};
try {
  state = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  state = {};
}

state.consecutiveFailures = 0;
state.cooldownUntil = null;
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(file, JSON.stringify(state, null, 2));
console.log("Cooldown cleared:", file);
