# Arcus Personal Trading Analytics Dashboard

A high-performance personal trading terminal and analytics dashboard built for the **Arcus Perpetuals Exchange** (`https://docs.arcus.xyz/`). Replicates the high-density crypto/perps aesthetic with live REST API integration, FIFO trade matching, holding time analytics, open interest tracking, and weekly farm epoch share modeling.

---

## ⚡ Quick Start

### 1. Start the Local Server
From the project directory (`e:\My arcus`), start the local server:
```bash
npm start
```
*Or directly with Node (zero external dependencies required):*
```bash
node server.js
```

### 2. Open in Browser
Visit **`http://localhost:3000`** in your browser.

---

## 🚀 Key Features

### 1. Holding & Weekly Share (Main Reference View)
- **Daily Volume Stacked Bar Chart**: Breakdown of trading volume across assets (`BTC-USD`, `ETH-USD`, `SOL-USD`, `HYPE-USD`, `PUMP-USD`, `XRP-USD`, `LIT-USD`), color-coded with interactive tooltips and total asset volume legend.
- **Arcus Weekly Share & Farm Epochs**:
  - Calculates share for Arcus farm epochs (Wednesday 19:00 UTC → Wednesday 19:00 UTC).
  - Displays: `This week: volume share`, `This week: OI share`, `Last week share`, and live countdown (`Week closes in Xd Xh`).
  - Progress share bars and epoch comparison table with `in progress` badge.
- **Position Holding Analytics**:
  - Average holding duration per closed piece (days/hours).
  - "Still holding" duration for active open inventory lots.
  - Average size in pairs and daily maximum position size markers (dashed line with dollar labels).
  - Time in position (% active) and Turnover to holding ratio.
  - Interactive click-to-inspect: selecting any bar or table row updates the right-hand **Inspector Card** with exact ticker breakdown and period PnL.
  - Granularity switchers: `[By day]`, `[By week]`, `[By epoch]`.

### 2. Trades & Fills History
- Complete ledger of all 67+ fills fetched from `/v1/fills`.
- Columns: Timestamp (UTC), Market, Side (`BUY`/`SELL`), Effect (`OPEN_SHORT`, `CLOSE_SHORT`, `OPEN_LONG`), Size, Price, Notional, Fee Paid, Closed Realized PnL, Maker/Taker Role, and Order ID.
- Real-time search filter and dropdown filters for Market and Side.
- Instant **CSV Export** button.

### 3. PnL & Portfolio Equity Curve
- Interactive dual-axis chart fetched directly from `/v1/portfolio`.
- Emerald gradient area chart showing real-time account equity progression.
- Cyan dashed line showing cumulative PnL trajectory.
- Resolution toggles: `24h`, `7d`, `30d`, `All-Time`.
- Daily Realized PnL bar chart with profit (green) vs loss (red) bars and fee overlay.

### 4. Live Open Positions & Risk (OI)
- Active positions monitoring directly from `/v1/positions` and `/v1/account`.
- Detailed card for active trades (e.g. `XRP-USD` Short 10x cross), showing size, entry price, mark price, notional value, margin used, unrealized PnL, and cumulative funding earned.

### 5. Fee & Funding Breakdown
- Fee Tier status from `/v1/account/stats`: Level 0 (Base), 0 bps Maker / 2.25 bps Taker fee schedule.
- 30-Day Rolling volume tracker.
- Historical log of 114+ funding payments from `/v1/funding` with payment amounts and funding rates.

### 6. Wallet Management & Live Sync
- Configured by default for your wallet: `0x3484a6A12409902379Db26c9B56D52592AE25727`.
- **Change Wallet modal**: switch to any Ethereum wallet on Arcus with instant re-calculation.
- **Copy address** button with copy-confirmation tooltip.
- Auto-refresh every 30 seconds with a pulsating `LIVE SYNC` indicator.
- Manual refresh button with animated rotation.
- **Full Report Export**: download comprehensive JSON report.

---

## 📡 Live Arcus API Endpoints Integrated

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/v1/account/stats` | `GET` | 30D volume, lifetime volume, fees paid, fee tier rates |
| `/v1/account` | `GET` | Account equity, free collateral, net deposits, balances |
| `/v1/positions` | `GET` | Current open positions, margin used, mark prices |
| `/v1/fills` | `GET` | All historical fills, sides, prices, realized PnL, fees |
| `/v1/orders` | `GET` | Placed orders and order lifecycle statuses |
| `/v1/portfolio` | `GET` | Historical account equity and cumulative PnL time series |
| `/v1/funding` | `GET` | Real-time funding payments history and funding rates |
| `/v1/accountTransferUpdates` | `GET` | Deposits and withdrawals history |
| `/v1/markets` | `GET` | Configured markets, tick sizes, and step sizes |
| `/v1/leaderboard` | `GET` | Top exchange traders for benchmarking |

---

## 📂 Project Architecture

```
e:\My arcus\
├── index.html           # Main dashboard interface
├── server.js            # Zero-dependency local Node HTTP server
├── package.json         # NPM scripts configuration
├── css/
│   └── style.css        # Obsidian dark theme and glassmorphic card design system
├── js/
│   ├── api.js           # Arcus REST API client with live polling & fallback
│   ├── analytics.js     # FIFO trade matching & farm epoch holding engine
│   ├── charts.js        # Chart.js renderers with dashed max lines & tooltips
│   ├── app.js           # Main UI controller, event listeners, & data binding
│   └── snapshot.js      # Offline snapshot fallback
└── vendor/
    └── chart.umd.min.js # Standalone local Chart.js bundle
```
