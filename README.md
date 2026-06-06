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
- `POST /api/realtime/client-secret`
- `POST /api/realtime/sdp` legacy backend SDP proxy
- `GET /api/audio/state`
- `GET /api/audio/events`
- `POST /api/audio/interpret`
- `GET /api/demo/snapshot`
- `GET /api/demo/events`
- `POST /api/agents/classify`
- `POST /api/agents/respond`
- `POST /api/agents/parse-promo`
- `POST /api/agents/debrief`

These endpoints intentionally use deterministic placeholder logic. Keep real marketplace APIs, database persistence, and platform adapters behind these boundaries so the frontend demo can stay reliable.

## Audio Parser Flow

The browser captures camera and microphone audio. It sends a WebRTC SDP offer to `POST /api/realtime/sdp`; this backend forwards the offer to OpenAI Realtime with a transcription-only session using `REALTIME_TRANSCRIPTION_MODEL`.

Final transcript chunks are sent to `POST /api/audio/interpret`. The backend loads products from DynamoDB, falls back to demo products when DynamoDB is unavailable, calls an LLM for structured intent extraction, and applies valid product actions directly:

- `change_product` updates `Products.isCurrent` and publishes a `productChanged` event to `GET /api/audio/events`.
- `apply_discount` writes a `Discounts` record and publishes a `discountChanged` event to `GET /api/audio/events`.
- `spam` is ignored.

The event stream replays the latest `productChanged` and `discountChanged` payloads to new clients, and `GET /api/audio/state` returns the current product plus latest discount snapshot.

Set `OPENAI_API_KEY` for live transcription and LLM extraction. If the intent LLM call fails, `/api/audio/interpret` returns an error instead of guessing locally.

Set `USE_DYNAMODB=true` plus AWS credentials/region to use the current DynamoDB schema:

- `Products.productId` is the product key.
- `Products.isCurrent` marks the single live product.
- `Discounts.productId` + `Discounts.startAt` stores parsed live discounts.
