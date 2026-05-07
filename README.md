# Chartai CLI

Command-line access to Chartai Chart Context for agents and local terminal
workflows.

This beta package defaults to Chartai staging:

- API: `https://api.test.chartai.live`
- Web/key page: `https://test.chartai.live/app/keys`
- MCP: `https://mcp-staging.chartai.live/mcp`

Use the endpoints shown here for the beta runtime. Production URLs will be
published in Chartai docs when launch opens.

Use **subscription** only for Chartai billing plans and renewals. Durable agent
workflows are **watchlists**, **monitors**, and **feed**.

Agent flow: use `scan-contexts` to find current Chart Context, then use
`inspect-chart-context` before making a judgment. Keep the returned `context_id`
as the decision evidence ID. Use `get-record` and `search-records` with
`detection_id` only when you need historical lifecycle records.

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
chartai scan-contexts --symbol BINANCE:BTCUSDT --timeframe 1h
chartai inspect-chart-context ctx_12345 --output chart.png
chartai get-context-manifest ctx_12345
chartai confirm-chart-visual-inspection ctx_12345 ABCD --method cli_file
chartai check-context-condition ctx_12345 --condition-id price_above_vwap --parameters '{"window_days":3}'
chartai check-context-condition ctx_12345 --condition-id price_volume_state
chartai get-usage
chartai mcp-config
```

`inspect-chart-context` is the default judgment path after `scan-contexts`. It
saves the 1920x1080 inspection chart with a visible VC code when `--output` is provided,
then returns structured Chart Context JSON for verification. If the agent can
actually see the chart, read the VC code and call
`confirm-chart-visual-inspection`. If the runtime cannot see images, report
`visual_unverified` and continue with the structured context only. Use
`get-chart` only for explicit raw chart downloads.

## Supported Commands

- `connect`
- `get-status`
- `get-capabilities`
- `search-symbols`
- `resolve-symbol`
- `scan-contexts`
- `inspect-chart-context`
- `get-context-manifest`
- `confirm-chart-visual-inspection`
- `get-context`
- `get-chart`
- `get-record`
- `search-records`
- `check-context-condition`
- `get-timezone`, `set-timezone`
- `create-watchlist`, `list-watchlist`, `remove-watchlist`
- `create-monitor`, `list-monitors`, `pause-monitor`, `resume-monitor`, `delete-monitor`
- `list-feed`, `ack-feed`
- `get-usage`
- `mcp-config`

Chartai returns chart facts and Chart Context. It does not execute trades.
