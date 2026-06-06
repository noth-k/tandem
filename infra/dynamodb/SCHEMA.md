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
  - `price` (N) — store as a numeric price; for example `1399.00` for SGD 1,399.00
  - `currency` (S) — e.g. USD, SGD
  - `description` (S)
  - `sku` (S)
  - `platformIds` (M) — map of platform-specific ids (tiktok, shopee, lazada)
  - `tags` (L)
  - `isActive` (BOOL)
  - `createdAt` / `updatedAt` (S, ISO8601)
- Indexes:
  - `NameIndex` (GSI on `name`) — lookup by product name.

3) Messages
- Purpose: store buyer messages, classifier outputs and AI replies.
- Keys:
  - Partition key: `conversationId` (S) — e.g., stream id or chat room id
  - Sort key: `messageTimestamp` (S, ISO8601) — ensures ordered retrieval
- Attributes:
  - `buyerId` (S)
  - `buyerUsername` (S)
  - `buyerMessage` (S)
  - `aiCategory` (S) — classifier label (e.g., QUESTION, PURCHASE_INTENT, SPAM)
  - `aiResponse` (S) — the text the responder produced (if any)
- Indexes:
  - `BuyerIndex` (GSI on `buyerId`) — query messages by buyer.

4) Discounts
- Purpose: record discount campaigns and accepted promotions for products.
- Keys:
  - Partition key: `productId` (S)
  - Sort key: `startAt` (N) — epoch ms or unix timestamp to sort discount history
- Attributes:
  - `discountId` (S)
  - `discountValueAmount` (N, optional) — fixed discount amount in dollars
  - `discountValuePercent` (N, optional) — percentage off (0-100)
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
