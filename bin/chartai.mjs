#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

const DEFAULT_API_BASE = "https://api.chartai.live";
const DEFAULT_WEB_BASE = "https://chartai.live";
const DEFAULT_MCP_URL = "https://mcp.chartai.live/mcp";
const DEFAULT_CONTEXT_LIMIT = 5;

const PUBLIC_COMMANDS = new Set([
  "connect",
  "get-status",
  "get-capabilities",
  "search-symbols",
  "resolve-symbol",
  "mcp-config"
]);

function usage() {
  return `Chartai CLI

Usage:
  chartai connect --target cli|mcp|skill
  chartai get-capabilities
  chartai search-symbols --query BTC --asset crypto
  chartai search-symbols --asset stock --limit 100 --cursor AAPL.US
  chartai resolve-symbol AAPL
  chartai resolve-symbol FX:EURUSD
  chartai scan-contexts --symbol BINANCE:BTCUSDT --timeframe 1h
  chartai inspect-chart-context ctx_12345 --output chart.png
  chartai get-chart ctx_12345 --variant original --output original.png
  chartai get-context-manifest ctx_12345
  chartai get-context-ohlcv ctx_12345
  chartai get-context-ohlcv ctx_12345 --window wide
  chartai confirm-chart-visual-inspection ctx_12345 ABCD --method cli_file
  chartai check-context-condition ctx_12345 --condition-id price_above_vwap --parameters '{"window_days":3}'
  chartai list-feed --limit 20 --unread-only --cursor evt_12345
  chartai get-usage
  chartai mcp-config

Global options:
  --agent-key <key>     Agent key. Prefer CHARTAI_AGENT_KEY.
  --api-base <url>      Default: ${DEFAULT_API_BASE}
  --web-base <url>      Default: ${DEFAULT_WEB_BASE}
  --mcp-url <url>       Default: ${DEFAULT_MCP_URL}
  --output <path>       Save raw chart for get-chart or VC inspection chart for inspect-chart-context.
  --variant <name>      get-chart variant: decision or original. Default: decision.
  --window <name>       get-context-ohlcv window: context or wide. Default: context.
  --help, -h

Agent key:
  export CHARTAI_AGENT_KEY="..."

Use "subscription" only for Chartai billing plans and renewals. Durable agent workflows are watchlists, monitors, and feed.
`;
}

function parseArgv(argv) {
  const opts = {};
  const args = [];
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    const readValue = (name) => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${name} requires a value.`);
      }
      i += 1;
      return value;
    };
    if (item === "--agent-key") opts.agentKey = readValue(item);
    else if (item === "--api-base") opts.apiBase = readValue(item);
    else if (item === "--web-base") opts.webBase = readValue(item);
    else if (item === "--mcp-url") opts.mcpUrl = readValue(item);
    else if (item === "--target") opts.target = readValue(item);
    else if (item === "--session") opts.session = readValue(item);
    else if (item === "--return-to") opts.returnTo = readValue(item);
    else if (item === "--symbol") opts.symbol = readValue(item);
    else if (item === "--timeframe") opts.timeframe = readValue(item);
    else if (item === "--limit") opts.limit = Number(readValue(item));
    else if (item === "--asset") opts.asset = readValue(item);
    else if (item === "--exchange") opts.exchange = readValue(item);
    else if (item === "--cursor") opts.cursor = readValue(item);
    else if (item === "--query") opts.query = readValue(item);
    else if (item === "--from") opts.from = readValue(item);
    else if (item === "--to") opts.to = readValue(item);
    else if (item === "--pattern") opts.pattern = readValue(item);
    else if (item === "--status") opts.status = readValue(item);
    else if (item === "--output") opts.output = readValue(item);
    else if (item === "--variant") opts.variant = readValue(item);
    else if (item === "--window") opts.window = readValue(item);
    else if (item === "--condition-id") opts.conditionId = readValue(item);
    else if (item === "--parameters") opts.parameters = readValue(item);
    else if (item === "--method") opts.method = readValue(item);
    else if (item === "--observations") opts.observations = readValue(item);
    else if (item === "--name") opts.name = readValue(item);
    else if (item === "--inline-key") opts.inlineKey = true;
    else if (item === "--unread-only") opts.unreadOnly = true;
    else if (item === "--json") opts.json = true;
    else if (item === "--help" || item === "-h") opts.help = true;
    else if (item.startsWith("--")) throw new Error(`Unknown option: ${item}`);
    else args.push(item);
  }
  return { command: args[0], positionals: args.slice(1), opts };
}

function apiBase(opts) {
  return (opts.apiBase || process.env.CHARTAI_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function webBase(opts) {
  return (opts.webBase || process.env.CHARTAI_WEB_URL || DEFAULT_WEB_BASE).replace(/\/+$/, "");
}

function mcpUrl(opts) {
  return opts.mcpUrl || process.env.CHARTAI_MCP_URL || DEFAULT_MCP_URL;
}

function agentKey(opts, requiredFor) {
  const key = (opts.agentKey || process.env.CHARTAI_AGENT_KEY || "").trim();
  if (!key && requiredFor) {
    throw new Error(
      "Chartai agent key is required. Run `chartai connect --target cli` to open the web key flow, then set CHARTAI_AGENT_KEY."
    );
  }
  return key;
}

function printJson(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function appendParams(path, params = {}) {
  const url = new URL(`${DEFAULT_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
}

function requireContextId(contextRef) {
  const value = String(contextRef || "").trim();
  if (!value.startsWith("ctx_")) {
    throw new Error("context_id must use the Chart Context id form, e.g. ctx_123.");
  }
  return value;
}

async function requestJson(opts, method, path, { params, body, auth = true } = {}) {
  const key = agentKey(opts, auth);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const url = `${apiBase(opts)}${appendParams(path, params)}`;
  const headers = { "content-type": "application/json" };
  if (auth && key) headers.authorization = `Bearer ${key}`;
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { detail: text.slice(0, 200) };
    }
    if (!response.ok) {
      const detail = typeof data.detail === "object" ? data.detail.detail : data.detail;
      const code = data.code || (typeof data.detail === "object" ? data.detail.code : undefined);
      const lines = [`HTTP ${response.status} ${code || ""}: ${detail || JSON.stringify(data)}`];
      if (data.hint) lines.push(`Hint: ${data.hint}`);
      if (data.guidance && typeof data.guidance === "object") {
        if (data.guidance.summary) lines.push(`Guidance: ${data.guidance.summary}`);
        const actions = Array.isArray(data.guidance.next_actions)
          ? data.guidance.next_actions.map((item) => item && item.action).filter(Boolean)
          : [];
        if (actions.length) lines.push(`Next actions: ${actions.join(", ")}`);
      }
      throw new Error(lines.join("\n"));
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadChartFile(opts, contextRef, outputPath, chartPath) {
  const key = agentKey(opts, true);
  const contextId = requireContextId(contextRef);
  const variant = (opts.variant || "decision").toLowerCase();
  if (variant !== "decision" && variant !== "original") {
    throw new Error("variant must be decision or original.");
  }
  const variantPath = variant === "original"
    ? `/api/v1/contexts/${contextId}/original-chart`
    : `/api/v1/contexts/${contextId}/chart`;
  const path = chartPath || variantPath;
  const url = `${apiBase(opts)}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${key}`,
      accept: "image/*,application/json"
    }
  });
  if (!response.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await response.json());
    } catch {
      detail = await response.text();
    }
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  if (!outputPath) return { url };
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
  return { path: outputPath };
}

async function downloadChart(opts, contextRef) {
  const result = await downloadChartFile(opts, contextRef, opts.output);
  process.stdout.write(`${result.path || result.url}\n`);
}

function parseJsonObject(text, fallback = {}) {
  if (!text) return fallback;
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("parameters must be a JSON object.");
  }
  return value;
}

async function run(parsed) {
  const { command, positionals, opts } = parsed;
  if (!command || opts.help) {
    process.stdout.write(usage());
    return;
  }

  if (command === "connect") {
    const target = opts.target || "cli";
    const url = new URL(`${webBase(opts)}/connect`);
    url.searchParams.set("target", target);
    if (opts.session) url.searchParams.set("session", opts.session);
    if (opts.returnTo) url.searchParams.set("return_to", opts.returnTo);
    printJson({
      connect_url: url.toString(),
      target,
      env: "CHARTAI_AGENT_KEY",
      flow: "manual_web_agent_key",
      next: [
        "Open connect_url in a browser.",
        "Register or log in, verify email, and pay or renew in Chartai Web if needed.",
        "Create or copy an Agent Key in Chartai Web.",
        "Export CHARTAI_AGENT_KEY locally before protected commands."
      ]
    });
    return;
  }

  if (command === "mcp-config") {
    const keyRef = opts.inlineKey ? agentKey(opts, true) : "${CHARTAI_AGENT_KEY}";
    printJson({
      mcpServers: {
        chartai: {
          url: mcpUrl(opts),
          headers: { Authorization: `Bearer ${keyRef}` }
        }
      }
    });
    return;
  }

  const auth = !PUBLIC_COMMANDS.has(command);
  const publicDiscoveryAuth = Boolean(agentKey(opts, false));
  const get = (path, params, publicDiscovery = false) => requestJson(opts, "GET", path, { params, auth: publicDiscovery ? publicDiscoveryAuth : auth });
  let data;

  if (command === "get-status") data = await get("/api/v1/status", undefined, true);
  else if (command === "get-capabilities") data = await get("/api/v1/capabilities", undefined, true);
  else if (command === "search-symbols") data = await get("/api/v1/symbols/search", { query: opts.query, asset: opts.asset, limit: opts.limit || 50, cursor: opts.cursor }, true);
  else if (command === "resolve-symbol") data = await get("/api/v1/symbols/resolve", { symbol: positionals[0] || opts.symbol }, true);
  else if (command === "scan-contexts") data = await get("/api/v1/contexts", { symbol: opts.symbol, timeframe: opts.timeframe, limit: opts.limit || DEFAULT_CONTEXT_LIMIT });
  else if (command === "search-records") data = await get("/api/v1/records", { from: opts.from, to: opts.to, pattern: opts.pattern, status: opts.status || "all", limit: opts.limit || 20, cursor: opts.cursor });
  else if (command === "get-record") data = await get(`/api/v1/records/${positionals[0]}`);
  else if (command === "get-context") data = await get(`/api/v1/contexts/${requireContextId(positionals[0])}`);
  else if (command === "inspect-chart-context") {
    const contextRef = requireContextId(positionals[0]);
    data = await get(`/api/v1/contexts/${contextRef}/inspect`);
    const chart = data.chart && typeof data.chart === "object" ? data.chart : {};
    const endpoint = chart.endpoint || chart.chart_endpoint || `/api/v1/contexts/${contextRef}/chart`;
    const inspectionEndpoint = chart.inspection_endpoint || `/api/v1/contexts/${contextRef}/inspect/chart`;
    chart.chart_endpoint = endpoint;
    chart.inspection_endpoint = inspectionEndpoint;
    chart.full_native_chart_url = `${apiBase(opts)}${endpoint}`;
    chart.full_inspection_chart_url = `${apiBase(opts)}${inspectionEndpoint}`;
    if (opts.output) {
      const saved = await downloadChartFile(opts, contextRef, opts.output, inspectionEndpoint);
      chart.path = saved.path;
    }
    data.chart = chart;
  }
  else if (command === "get-context-manifest") data = await get(`/api/v1/contexts/${requireContextId(positionals[0])}/manifest`);
  else if (command === "get-context-ohlcv") {
    const window = (opts.window || "context").toLowerCase();
    if (window !== "context" && window !== "wide") {
      throw new Error("window must be context or wide.");
    }
    data = await get(`/api/v1/contexts/${requireContextId(positionals[0])}/ohlcv`, { window });
  }
  else if (command === "confirm-chart-visual-inspection") {
    if (!positionals[0] || !positionals[1]) {
      throw new Error("confirm-chart-visual-inspection requires context_id and observed visual code.");
    }
    data = await requestJson(opts, "POST", `/api/v1/contexts/${requireContextId(positionals[0])}/visual-confirmation`, {
      auth: true,
      body: {
        observed_visual_code: positionals[1],
        method: opts.method || "cli_file",
        observations: opts.observations || ""
      }
    });
  }
  else if (command === "get-chart") {
    await downloadChart(opts, positionals[0]);
    return;
  }
  else if (command === "check-context-condition") data = await requestJson(opts, "POST", `/api/v1/contexts/${requireContextId(positionals[0])}/conditions`, { auth: true, body: { condition_id: opts.conditionId, parameters: parseJsonObject(opts.parameters) } });
  else if (command === "get-timezone") data = await get("/api/v1/timezone");
  else if (command === "set-timezone") data = await requestJson(opts, "PUT", "/api/v1/timezone", { auth: true, body: { timezone: positionals[0] } });
  else if (command === "create-watchlist") data = await requestJson(opts, "POST", "/api/v1/watchlists", { auth: true, body: { symbol: positionals[0] } });
  else if (command === "list-watchlist") data = await get("/api/v1/watchlists");
  else if (command === "remove-watchlist") data = await requestJson(opts, "DELETE", `/api/v1/watchlists/${encodeURIComponent(positionals[0])}`, { auth: true });
  else if (command === "create-monitor") data = await requestJson(opts, "POST", "/api/v1/monitors", { auth: true, body: { name: opts.name, symbol_filters: opts.symbol ? [opts.symbol] : [], pattern_filters: opts.pattern ? [opts.pattern] : [], timeframe_filters: opts.timeframe ? [opts.timeframe] : [] } });
  else if (command === "list-monitors") data = await get("/api/v1/monitors");
  else if (command === "pause-monitor" || command === "resume-monitor") data = await requestJson(opts, "POST", `/api/v1/monitors/${positionals[0]}/${command.startsWith("pause") ? "pause" : "resume"}`, { auth: true, body: {} });
  else if (command === "delete-monitor") data = await requestJson(opts, "DELETE", `/api/v1/monitors/${positionals[0]}`, { auth: true });
  else if (command === "list-feed") data = await get("/api/v1/feed", { limit: opts.limit || 50, unread_only: Boolean(opts.unreadOnly), cursor: opts.cursor });
  else if (command === "ack-feed") data = await requestJson(opts, "POST", "/api/v1/feed/ack", { auth: true, body: { event_ids: positionals } });
  else if (command === "get-usage") data = await get("/api/v1/usage");
  else throw new Error(`Unknown command: ${command}`);

  printJson(data);
}

run(parseArgv(process.argv.slice(2))).catch((error) => {
  process.stderr.write(`chartai: ${error.message}\n`);
  process.exit(1);
});
