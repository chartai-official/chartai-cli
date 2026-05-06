import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import test from "node:test";

function spawnNode(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn("node", args, options);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

test("help prints Chartai CLI usage", () => {
  const result = spawnSync("node", ["bin/chartai.mjs", "--help"], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Chartai CLI/);
  assert.match(result.stdout, /scan --symbol/);
  assert.match(result.stdout, /inspect-chart-context ctx_12345 --output chart\.png/);
  assert.match(result.stdout, /get-context-manifest ctx_12345/);
  assert.match(result.stdout, /confirm-chart-visual-inspection ctx_12345 ABCD/);
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

test("inspect-chart-context without key shows onboarding guidance", () => {
  const result = spawnSync("node", ["bin/chartai.mjs", "inspect-chart-context", "ctx_123"], {
    encoding: "utf8",
    env: { ...process.env, CHARTAI_AGENT_KEY: "", CHARTAI_API_KEY: "" }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Chartai agent key is required/);
  assert.match(result.stderr, /chartai connect --target cli/);
});

test("inspect_chart_context alias without key shows onboarding guidance", () => {
  const result = spawnSync("node", ["bin/chartai.mjs", "inspect_chart_context", "ctx_123"], {
    encoding: "utf8",
    env: { ...process.env, CHARTAI_AGENT_KEY: "", CHARTAI_API_KEY: "" }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Chartai agent key is required/);
});

test("get-context-manifest without key shows onboarding guidance", () => {
  const result = spawnSync("node", ["bin/chartai.mjs", "get-context-manifest", "ctx_123"], {
    encoding: "utf8",
    env: { ...process.env, CHARTAI_AGENT_KEY: "", CHARTAI_API_KEY: "" }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Chartai agent key is required/);
});

test("confirm-chart-visual-inspection without key shows onboarding guidance", () => {
  const result = spawnSync("node", ["bin/chartai.mjs", "confirm-chart-visual-inspection", "ctx_123", "ABCD"], {
    encoding: "utf8",
    env: { ...process.env, CHARTAI_AGENT_KEY: "", CHARTAI_API_KEY: "" }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Chartai agent key is required/);
});

test("inspect-chart-context downloads chart and enriches output", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "chartai-cli-"));
  const chartPath = join(tmp, "chart.png");
  const chartBytes = Buffer.from("pngbytes");
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer cak_test");
    if (req.url === "/api/v1/contexts/ctx_123/inspect") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        chart: {
          endpoint: "/api/v1/contexts/ctx_123/chart",
          inspection_endpoint: "/api/v1/contexts/ctx_123/inspect/chart",
          dimensions: { width: 1920, height: 1080 }
        },
        context: { context_id: "ctx_123" }
      }));
      return;
    }
    if (req.url === "/api/v1/contexts/ctx_123/inspect/chart") {
      res.setHeader("content-type", "image/png");
      res.end(chartBytes);
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    const result = await spawnNode(
      [
        "bin/chartai.mjs",
        "inspect-chart-context",
        "ctx_123",
        "--api-base",
        `http://127.0.0.1:${port}`,
        "--output",
        chartPath
      ],
      {
        encoding: "utf8",
        env: { ...process.env, CHARTAI_AGENT_KEY: "cak_test" }
      }
    );
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    assert.equal(body.chart.path, chartPath);
    assert.equal(
      body.chart.full_native_chart_url,
      `http://127.0.0.1:${port}/api/v1/contexts/ctx_123/chart`
    );
    assert.equal(
      body.chart.full_inspection_chart_url,
      `http://127.0.0.1:${port}/api/v1/contexts/ctx_123/inspect/chart`
    );
    assert.deepEqual(readFileSync(chartPath), chartBytes);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("get-context-manifest calls manifest endpoint", async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer cak_test");
    assert.equal(req.url, "/api/v1/contexts/ctx_123/manifest");
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ manifest: { schema: "chartai.context_manifest.v1" } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    const result = await spawnNode(
      ["bin/chartai.mjs", "get-context-manifest", "ctx_123", "--api-base", `http://127.0.0.1:${port}`],
      { encoding: "utf8", env: { ...process.env, CHARTAI_AGENT_KEY: "cak_test" } }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).manifest.schema, "chartai.context_manifest.v1");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("confirm-chart-visual-inspection posts observed code", async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer cak_test");
    assert.equal(req.url, "/api/v1/contexts/ctx_123/visual-confirmation");
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const payload = JSON.parse(body);
      assert.equal(payload.observed_visual_code, "ABCD");
      assert.equal(payload.method, "cli_file");
      assert.equal(payload.observations, "reviewed");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ visual_status: "visual_confirmed" }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    const result = await spawnNode(
      [
        "bin/chartai.mjs",
        "confirm-chart-visual-inspection",
        "ctx_123",
        "ABCD",
        "--method",
        "cli_file",
        "--observations",
        "reviewed",
        "--api-base",
        `http://127.0.0.1:${port}`
      ],
      { encoding: "utf8", env: { ...process.env, CHARTAI_AGENT_KEY: "cak_test" } }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).visual_status, "visual_confirmed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
