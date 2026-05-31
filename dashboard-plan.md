# Plan: AI Trader Web Dashboard

## Overview
A React web dashboard to monitor and control the human-like AI trading agent. Since the trader is a local Python CLI app, the dashboard will read from the `memory.json` and `trading.log` files produced by the trader, and provide a REST API bridge.

## Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                     AI TRADER DASHBOARD                              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Portfolio   │  │   Agent      │  │   P&L        │              │
│  │  Overview    │  │   Mood       │  │   Chart      │              │
│  │  (cards)     │  │   (emoji)    │  │  (recharts)  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌──────────────────────────┐  ┌──────────────────────────┐         │
│  │    Trade History         │  │    Agent's Thoughts      │         │
│  │    (sortable table)      │  │    (live reasoning log)  │         │
│  └──────────────────────────┘  └──────────────────────────┘         │
│                                                                      │
│  ┌──────────────────────────┐  ┌──────────────────────────┐         │
│  │  Personality Settings    │  │  Market Snapshot         │         │
│  │  (sliders + save)        │  │  (BTC/ETH price + RSI)   │         │
│  └──────────────────────────┘  └──────────────────────────┘         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  🛑 KILL SWITCH  │  Status: 🟢 Running  │  Cycle #42        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Pages
- **Dashboard** (main): Portfolio, mood, P&L chart, recent trades, thoughts
- **Settings**: Personality sliders, risk limits, symbol selection
- **Logs**: Full trading.log viewer

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS
- Recharts for charts
- Shadcn/ui components
- Simulated data (since the Python app runs locally, dashboard shows mock data that matches the real format)

## Deliverable
Static web app deployed to a public URL
