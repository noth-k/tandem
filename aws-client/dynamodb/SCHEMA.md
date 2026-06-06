DynamoDB Schema for live-commerce AI co-host prototype

Overview
--------
This document lists the DynamoDB tables and primary attributes used by the prototype.

Tables
------

1) ProductNames
- Purpose: quick lookup of products by human-readable name (allows duplicate names across productIds).
- Keys:
  - Partition key: `name` (S)
  - Sort key: `productId` (S)
- Useful attributes: none required — this is a small index table.

2) Products
- Purpose: canonical product metadata and inventory.
- Keys:
  - Partition key: `productId` (S)
- Attributes:
  - `name` (S)
  - `stockQty` (N)
  - `price` (N) — store in smallest currency unit (e.g., cents) or as decimal
  - `currency` (S) — e.g. USD, SGD
  - `description` (S)
  - `sku` (S)
  - `platformIds` (M) — map of platform-specific ids (tiktok, shopee, lazada)
  - `tags` (L)
  - `isActive` (BOOL)
  - `isCurrent` (BOOL) — true for the single product currently being shown in the live stream; exactly one product should be true at a time.
  - `createdAt` / `updatedAt` (S, ISO8601)
- Indexes:
  - `NameIndex` (GSI on `name`) — lookup by product name.

3) Messages
- Purpose: store buyer messages, classifier outputs and AI replies.
- Keys:
  - Partition key: `conversationId` (S) — unique message/conversation id for a single chat message
  - Sort key: `messageTimestamp` (S, ISO8601) — message creation time
- Attributes:
  - `messageId` (S) — same value as `conversationId` for frontend-originated buyer messages
  - `livestreamId` (S) — id of the livestream session this message belongs to; use this to filter stale messages from previous streams
  - Snake-case aliases are also written for frontend/backend message compatibility:
    `conversation_id`, `conversation_timestamp`, `message`, `product_id`, `buyer_username`, `livestream_id`
  - `buyerId` (S)
  - `buyerUsername` (S)
  - `messageText` (S)
  - `productId` (S)
  - `aiCategory` (S) — classifier label (e.g., QUESTION, PURCHASE_INTENT, SPAM)
  - `aiResponse` (S) — the text the responder Lambda produced (if any)
  - `replySent` (BOOL)
  - `priority` (N) — numeric priority for escalation
  - `escalated` (BOOL)
  - `createdAt` (S)
- Indexes:
  - `BuyerIndex` (GSI on `buyerId`) — query messages by buyer.

4) Discounts
- Purpose: record discount campaigns and accepted promotions for products.
- Keys:
  - Partition key: `productId` (S)
  - Sort key: `startAt` (N) — epoch ms or unix timestamp to sort discount history
- Attributes:
  - `discountId` (S)
  - `valueAmount` (N, optional) — fixed amount off in smallest currency unit
  - `valuePercent` (N, optional) — percentage off (0-100)
  - `startAt` (N)
  - `endAt` (N)
  - `acceptedBySeller` (BOOL)
  - `appliedBy` (S) — agent id or seller id
  - `createdAt` (S)

Notes
-----
- All tables are created with `PAY_PER_REQUEST` billing mode in the provided script for simplicity in a demo/hackathon environment.
- Timestamps: prefer ISO8601 strings for readability in the UI; use unix epoch numbers for numeric sort keys where noted.
- Storing monetary values: use integer smallest-unit or a well-defined decimal field to avoid float issues.
- Current product invariant: application code should update `isCurrent` through a helper that clears the previous current product and marks the new one in the same operation.
