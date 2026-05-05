# Chartai CLI

Command-line access to Chartai Chart Context for agents and local terminal
workflows.

This beta package defaults to Chartai staging:

- API: `https://api.test.chartai.live`
- Web/key page: `https://test.chartai.live/app/keys`
- MCP: `https://mcp-staging.chartai.live/mcp`

## Install From GitHub

```bash
npm install -g github:chartai-official/chartai-cli
chartai --help
```

## Agent Key

```bash
chartai connect --target cli
export CHARTAI_AGENT_KEY="..."
```

Never paste the raw key into an agent response.

## Common Commands

```bash
chartai get-capabilities
chartai search-symbols --query BTC --asset crypto
chartai scan --symbol BINANCE:BTCUSDT --timeframe 1h
chartai get-context ctx_12345
chartai check-context-condition ctx_12345 --condition-id price_above_vwap --parameters '{"window_days":3}'
chartai check-context-condition ctx_12345 --condition-id price_volume_state
chartai get-usage
chartai mcp-config
```

## Supported Commands

- `connect`
- `get-status`, `get_status`
- `get-capabilities`, `get_capabilities`, `patterns`, `list-patterns`, `list_patterns`
- `search-symbols`, `search_symbols`, `list-symbols`, `list_symbols`
- `resolve-symbol`, `resolve_symbol`
- `scan`, `scan-contexts`, `scan_contexts`
- `get-context`, `get_context`
- `get-chart`, `get_chart`, `chart`
- `record`, `get-record`, `get_record`
- `records`, `search-records`, `search_records`
- `check-context-condition`, `check_context_condition`
- `get-timezone`, `set-timezone`
- `create-watchlist`, `list-watchlist`, `remove-watchlist`
- `create-monitor`, `list-monitors`, `pause-monitor`, `resume-monitor`, `delete-monitor`
- `list-feed`, `ack-feed`
- `doctor`, `get-usage`, `get_usage`, `get-quota`, `get_quota`
- `mcp-config`

Chartai returns chart facts and Chart Context. It does not execute trades.

