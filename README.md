# tandem

Express backend skeleton for the Tandem live-commerce AI co-host hackathon demo.

The sibling `stop-sign` project is the frontend cockpit. This backend exposes small, mock-friendly API boundaries for the same four agent paths: chat classification, response drafting, promo parsing, and post-stream debriefs.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Default server: `http://localhost:4000`

## Scripts

```bash
npm run dev      # start Express with node --watch
npm run start    # start Express normally
npm run check    # syntax-check server entrypoints
```

## Routes

- `GET /health`
- `GET /api/demo/snapshot`
- `GET /api/demo/events`
- `POST /api/agents/classify`
- `POST /api/agents/respond`
- `POST /api/agents/parse-promo`
- `POST /api/agents/debrief`

These endpoints intentionally use deterministic placeholder logic. Keep real marketplace APIs, database persistence, and platform adapters behind these boundaries so the frontend demo can stay reliable.
