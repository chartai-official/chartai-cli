# Chartai CLI

Command-line access to Chartai Chart Context for agents and local terminal
workflows.

Default endpoints:

- API: `https://api.chartai.live`
- Web/key page: `https://chartai.live/app/keys`
- MCP: `https://mcp.chartai.live/mcp`

Use **subscription** only for Chartai billing plans and renewals. Durable agent
workflows are **watchlists**, **monitors**, and **feed**.

Agent flow: use `scan-contexts` to find current Chart Context, then use
`inspect-chart-context` before making a judgment. Keep the returned `context_id`
as the decision evidence ID. Use `get-record` and `search-records` with
`detection_id` only when you need historical lifecycle records. Use
`get-context-ohlcv` only when you need the candles attached to the selected
context's chart window; pass `--window wide` for wider data-only context around
the same Chart Context. Use `get-chart --variant original` when the agent needs
a persistent clean image containing only wider-context candles, Volume, and
pattern geometry. Use `render-agent-chart` when the agent has its own live
thesis and needs Chartai to render a persistent TradingView-based chart from a
symbol, interval, focus range, optional source context id, and overlays. Include
the context id to keep the original pattern shape; Chartai may add safety
margin around the focus range so labels and source pattern shapes are not
clipped. Send retest support/resistance areas as zones or two-price Retest
support/resistance overlays; use Dynamic or Trendline labels only for sloped
lines. Do not upload OHLCV.

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
chartai search-symbols --query TRX --asset crypto
chartai search-symbols --asset stock --limit 100
chartai search-symbols --asset forex --limit 100 --cursor OANDA:EUR_USD
chartai resolve-symbol AAPL
chartai resolve-symbol FX:EURUSD
chartai scan-contexts --symbol BINANCE:BTCUSDT --timeframe 1h
chartai inspect-chart-context ctx_12345 --output chart.png
chartai get-chart ctx_12345 --variant original --output original.png
chartai render-agent-chart --spec-file agent-chart.json --output agent-chart.png
chartai get-context-manifest ctx_12345
chartai get-context-ohlcv ctx_12345
chartai get-context-ohlcv ctx_12345 --window wide
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
`get-chart` only for explicit raw chart downloads. `get-chart --variant original`
downloads the stored original chart variant: candles, Volume, and pattern
geometry only, with indicators, entry, stop, and targets removed. It uses a
wider context window than the decision chart, then persists the generated image.

`get-context-ohlcv` returns the OHLCV candles for the selected context's chart
window. It is meant for auditing the chart evidence after a context is chosen,
not for general price-feed access. Add `--window wide` when the agent needs more
left/right candle context for its own drawing or distant support/resistance
review; wide mode returns data only and does not request another chart image.

`render-agent-chart` creates a new permanent agent chart artifact from
TradingView `symbol`, `interval`, focus `range`, optional source context id,
structured overlays, and optional studies. It is for agent-owned follow-up
drawings after the agent has done its own real-time analysis elsewhere. This
action requires Pro, and each accepted request uses 5 Chart Context units.
Include the context id to keep the original pattern shape. Chartai may add
safety margin around the focus range so labels and source pattern shapes are not
clipped. Send retest support/resistance areas as zones or two-price Retest
overlays, and use Dynamic/Trendline labels only for sloped lines. It does not
accept uploaded OHLCV; use the agent's Bybit or exchange data only to decide what
symbol/range/levels to request.

Run `search-symbols` or `resolve-symbol` before scanning user tickers. Chartai
normalizes crypto, US stock, and forex/metals aliases into provider canonical
symbols such as `BINANCE:TRXUSDT`, `AAPL.US`, and `OANDA:EUR_USD`. Symbol
discovery means Chartai can normalize the symbol; `scan-contexts` returns
current contexts only when a ready native chart exists for that symbol/timeframe.
No ready context? Chartai can queue a fresh scan; wait, then retry the same
query.
`search-symbols` is paginated across crypto, US stocks, and forex/metals. If
the response has `has_more=true`, call it again with `--cursor <next_cursor>`
until `has_more=false`. Do not treat the first 100 results as the full catalog.
`list-feed` is also paginated; keep calling it with `--cursor <next_cursor>`
until `has_more=false`.

Agent-facing API errors include `guidance`. The CLI prints the hint, guidance
summary, and next action names; follow those before changing symbols,
timeframes, ids, or command names.

## Supported Commands

- `connect`
- `get-status`
- `get-capabilities`
- `search-symbols`
- `resolve-symbol`
- `scan-contexts`
- `inspect-chart-context`
- `get-context-manifest`
- `get-context-ohlcv`
- `confirm-chart-visual-inspection`
- `get-context`
- `get-chart`
- `render-agent-chart`
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
