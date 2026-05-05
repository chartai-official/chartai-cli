import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("help prints Chartai CLI usage", () => {
  const result = spawnSync("node", ["bin/chartai.mjs", "--help"], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Chartai CLI/);
  assert.match(result.stdout, /scan --symbol/);
});

test("protected command without key shows onboarding guidance", () => {
  const result = spawnSync("node", ["bin/chartai.mjs", "scan", "--symbol", "BINANCE:BTCUSDT", "--timeframe", "1h"], {
    encoding: "utf8",
    env: { ...process.env, CHARTAI_AGENT_KEY: "", CHARTAI_API_KEY: "" }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Chartai agent key is required/);
  assert.match(result.stderr, /chartai connect --target cli/);
});

test("get-chart without key shows onboarding guidance", () => {
  const result = spawnSync("node", ["bin/chartai.mjs", "get-chart", "ctx_123"], {
    encoding: "utf8",
    env: { ...process.env, CHARTAI_AGENT_KEY: "", CHARTAI_API_KEY: "" }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Chartai agent key is required/);
});
