#!/usr/bin/env node

const DEFAULT_API_BASE = "https://api.test.chartai.live";
const DEFAULT_WEB_BASE = "https://test.chartai.live";
const DEFAULT_MCP_URL = "https://mcp-staging.chartai.live/mcp";
const DEFAULT_CONTEXT_LIMIT = 5;

const PUBLIC_COMMANDS = new Set([
  "connect",
  "get-status",
  "get_status",
  "status",
  "get-capabilities",
  "get_capabilities",
  "patterns",
  "list-patterns",
  "list_patterns",
  "search-symbols",
  "search_symbols",
  "list-symbols",
  "list_symbols",
  "resolve-symbol",
  "resolve_symbol",
  "mcp-config"
]);

function usage() {
  return `Chartai CLI (agent beta)

Usage:
  chartai connect --target cli|mcp|skill
  chartai get-capabilities
  chartai search-symbols --query BTC --asset crypto
  chartai scan --symbol BINANCE:BTCUSDT --timeframe 1h
  chartai get-context ctx_12345
  chartai check-context-condition ctx_12345 --condition-id price_above_vwap --parameters '{"window_days":3}'
  chartai get-usage
  chartai mcp-config

Global options:
  --api-key <key>       Agent key. Prefer CHARTAI_AGENT_KEY.
  --api-base <url>      Default: ${DEFAULT_API_BASE}
  --web-base <url>      Default: ${DEFAULT_WEB_BASE}
  --mcp-url <url>       Default: ${DEFAULT_MCP_URL}
  --help, -h

Agent key:
  export CHARTAI_AGENT_KEY="..."
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
    if (item === "--api-key") opts.apiKey = readValue(item);
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
    else if (item === "--condition-id") opts.conditionId = readValue(item);
    else if (item === "--parameters") opts.parameters = readValue(item);
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
  const key = (opts.apiKey || process.env.CHARTAI_AGENT_KEY || process.env.CHARTAI_API_KEY || "").trim();
  if (!key && requiredFor) {
    throw new Error(
      "Chartai agent key is required. Run `chartai connect --target cli`, create an agent key, then set CHARTAI_AGENT_KEY."
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
      throw new Error(`HTTP ${response.status} ${code || ""}: ${detail || JSON.stringify(data)}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
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
      next: [
        "Open connect_url in a browser.",
        "Create an agent key.",
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
  const get = (path, params, forcePublic = false) => requestJson(opts, "GET", path, { params, auth: forcePublic ? false : auth });
  let data;

  if (["get-status", "get_status", "status"].includes(command)) data = await get("/api/v1/status", undefined, true);
  else if (["get-capabilities", "get_capabilities", "patterns", "list-patterns", "list_patterns"].includes(command)) data = await get("/api/v1/capabilities", undefined, true);
  else if (["search-symbols", "search_symbols", "list-symbols", "list_symbols"].includes(command)) data = await get("/api/v1/symbols/search", { query: opts.query, asset: opts.asset, exchange: opts.exchange, limit: opts.limit || 50, cursor: opts.cursor }, true);
  else if (["resolve-symbol", "resolve_symbol"].includes(command)) data = await get("/api/v1/symbols/resolve", { symbol: positionals[0] || opts.symbol }, true);
  else if (["scan", "scan-contexts", "scan_contexts"].includes(command)) data = await get("/api/v1/contexts", { symbol: opts.symbol, timeframe: opts.timeframe, limit: opts.limit || DEFAULT_CONTEXT_LIMIT });
  else if (["records", "search-records", "search_records"].includes(command)) data = await get("/api/v1/records", { from: opts.from, to: opts.to, pattern: opts.pattern, status: opts.status || "all", limit: opts.limit || 20, cursor: opts.cursor });
  else if (["record", "get-record", "get_record"].includes(command)) data = await get(`/api/v1/records/${positionals[0]}`);
  else if (["get-context", "get_context"].includes(command)) data = await get(`/api/v1/contexts/${positionals[0]}`);
  else if (["get-chart", "get_chart", "chart"].includes(command)) data = await get(`/api/v1/contexts/${positionals[0].startsWith("ctx_") ? positionals[0] : `ctx_${positionals[0]}`}/chart`);
  else if (["check-context-condition", "check_context_condition"].includes(command)) data = await requestJson(opts, "POST", `/api/v1/contexts/${positionals[0]}/conditions`, { auth: true, body: { condition_id: opts.conditionId, parameters: parseJsonObject(opts.parameters) } });
  else if (["get-timezone", "get_timezone"].includes(command)) data = await get("/api/v1/timezone");
  else if (["set-timezone", "set_timezone"].includes(command)) data = await requestJson(opts, "PUT", "/api/v1/timezone", { auth: true, body: { timezone: positionals[0] } });
  else if (["create-watchlist", "create_watchlist", "add-watchlist", "add_watchlist"].includes(command)) data = await requestJson(opts, "POST", "/api/v1/watchlists", { auth: true, body: { symbol: positionals[0] } });
  else if (["list-watchlist", "list_watchlist"].includes(command)) data = await get("/api/v1/watchlists");
  else if (["remove-watchlist", "remove_watchlist"].includes(command)) data = await requestJson(opts, "DELETE", `/api/v1/watchlists/${encodeURIComponent(positionals[0])}`, { auth: true });
  else if (["create-monitor", "create_monitor"].includes(command)) data = await requestJson(opts, "POST", "/api/v1/monitors", { auth: true, body: { name: opts.name, symbol_filters: opts.symbol ? [opts.symbol] : [], pattern_filters: opts.pattern ? [opts.pattern] : [], timeframe_filters: opts.timeframe ? [opts.timeframe] : [] } });
  else if (["list-monitors", "list_monitors"].includes(command)) data = await get("/api/v1/monitors");
  else if (["pause-monitor", "pause_monitor", "resume-monitor", "resume_monitor"].includes(command)) data = await requestJson(opts, "POST", `/api/v1/monitors/${positionals[0]}/${command.startsWith("pause") ? "pause" : "resume"}`, { auth: true, body: {} });
  else if (["delete-monitor", "delete_monitor"].includes(command)) data = await requestJson(opts, "DELETE", `/api/v1/monitors/${positionals[0]}`, { auth: true });
  else if (["list-feed", "list_feed"].includes(command)) data = await get("/api/v1/feed", { limit: opts.limit || 50, unread_only: Boolean(opts.unreadOnly) });
  else if (["ack-feed", "ack_feed"].includes(command)) data = await requestJson(opts, "POST", "/api/v1/feed/ack", { auth: true, body: { event_ids: positionals } });
  else if (["doctor", "get-usage", "get_usage", "get-quota", "get_quota"].includes(command)) data = await get("/api/v1/usage");
  else throw new Error(`Unknown command: ${command}`);

  printJson(data);
}

run(parseArgv(process.argv.slice(2))).catch((error) => {
  process.stderr.write(`chartai: ${error.message}\n`);
  process.exit(1);
});

