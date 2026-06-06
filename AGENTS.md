# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Shape

This repo is the Tandem backend for a live-commerce AI co-host demo.

- Backend: Node.js/Express app under `src/`.
- Infrastructure: AWS CloudFormation, Lambda, and SQS/Lambda wiring under `infra/`.
- Shared AWS client helpers and schema notes under `aws-client/`.
- DynamoDB helper scripts and schema notes under `aws-client/dynamodb/`.
- Lambda source and bundling scripts: `infra/lambda/<function-name>/`.

Keep deployable infrastructure files under `infra/`. Keep reusable AWS client/helper code under `aws-client/`. Do not recreate the older root-level `cloudformation/`, `lambda/`, or `infra/dynamodb/` layouts.

## AWS Infrastructure Contract

The main stack is defined in `infra/cloudformation/template.yaml`.

Current AWS resources:

- DynamoDB tables:
  - `ProductNames`
  - `Products`
  - `Messages`
  - `Discounts`
- SQS queues:
  - `chat-queue`
  - `product-details-queue`
- Lambda functions:
  - `responder-agent-lambda`
  - `product-update-lambda`
  - `post-debrief-lambda`

Queue to Lambda mapping:

- `chat-queue` triggers `responder-agent-lambda`.
- `product-details-queue` triggers `product-update-lambda`.
- `post-debrief-lambda` is exposed through a Lambda Function URL.

Lambda environment variables from CloudFormation:

- `PRODUCT_NAME_TABLE`
- `PRODUCT_DETAILS_TABLE`
- `CHAT_MESSAGES_TABLE`
- `DISCOUNTS_TABLE`

When changing table, queue, function, or environment variable names, update all affected CloudFormation resources, Lambda code, backend config, documentation, and any message producers/consumers together.

## AWS Client Code

Reusable AWS helper code lives under `aws-client/`.

Current layout:

- `aws-client/dynamodb/client.py`: Python helpers for connecting to DynamoDB and reading/writing `Products`, `Messages`, `Discounts`, and `ProductNames`.
- `aws-client/dynamodb/create_tables.py`: standalone DynamoDB table creation script for local/manual setup.
- `aws-client/dynamodb/SCHEMA.md`: DynamoDB schema reference.
- `aws-client/dynamodb/requirements.txt`: Python dependencies for these helper scripts.

Treat `aws-client/` as shared client/support code, not deployed Lambda source by default. If Lambda code needs one of these helpers, either package it intentionally through the Lambda bundle process or duplicate only the small stable logic needed by that Lambda.

Keep scripts in this area aligned with the CloudFormation stack. If a table/index/key changes in `infra/cloudformation/template.yaml`, update `aws-client/dynamodb/SCHEMA.md`, `create_tables.py`, and `client.py` in the same change.

## Backend to SQS Guidance

The backend is an Express service under `src/`. Existing agent-like routes live in `src/routes/agents.js` and deterministic placeholder logic lives in `src/services/agentService.js`.

When adding backend SQS publishing:

- Prefer a small service module under `src/services/` for SQS publishing rather than putting AWS SDK calls directly in route handlers.
- Read queue URLs from environment variables, for example `CHAT_QUEUE_URL` and `PRODUCT_DETAILS_QUEUE_URL`.
- Keep request validation in routes or close to route boundaries.
- Send JSON messages with stable envelope fields so Lambda consumers can evolve safely.
- Include IDs and timestamps useful for idempotency and debugging.
- Do not commit AWS credentials, account IDs, or local `.env` files.

Prefer additive changes to these envelopes. If a breaking change is needed, update both the producer and Lambda consumer in the same change.

## Lambda Guidance

Each Lambda has:

- `index.py` as the handler source.
- `requirements.txt` for Python dependencies.
- `bundle.sh` to build `function.zip`.

The generated `function.zip` files are ignored and should not be committed.

When updating a Lambda:

- Keep handler entrypoint as `index.handler` unless CloudFormation is updated.
- Parse SQS events from `event["Records"]`.
- Treat each SQS record independently; one bad message should not silently hide the rest.
- Log enough structured context to debug message IDs and event types, but never log secrets.
- Use `boto3` in Lambda code when calling DynamoDB or other AWS services. Add non-runtime dependencies to the relevant `requirements.txt`.
- Keep function timeout and IAM permissions in `infra/cloudformation/template.yaml` aligned with new behavior.

Expected responsibilities:

- `responder-agent-lambda`: consume chat messages from `chat-queue`, classify/draft responses, and write message or response state to `Messages`.
- `product-update-lambda`: consume product update events from `product-details-queue`, update `Products`/`ProductNames`, and write discount records when needed.
- `post-debrief-lambda`: handle post-stream debrief requests through the Function URL and return JSON responses.

## DynamoDB Guidance

Schema documentation lives in `aws-client/dynamodb/SCHEMA.md`.

Table purpose:

- `ProductNames`: lookup from product name to `productId`.
- `Products`: canonical product metadata and inventory.
- `Messages`: buyer messages, classifier outputs, AI responses, and escalation state.
- `Discounts`: per-product discount campaigns and accepted promotions.

Use ISO8601 strings for readable timestamps unless the schema requires a numeric sort key, such as `Discounts.startAt`.

For money values, prefer integer smallest units such as cents to avoid float precision bugs.

## CloudFormation and IAM Guidance

Primary stack: `infra/cloudformation/template.yaml`.

Member access policy: `infra/cloudformation/member-access-policy.yaml`.

When adding AWS capabilities:

- Add least-privilege permissions to the Lambda role in the main template.
- If hackathon members need direct console/API access, update `member-access-policy.yaml` too.
- Preserve the `openai-sea-hackathon=true` tag on stack resources unless there is a deliberate reason to change tagging.
- Keep log groups and retention configured for new Lambda functions.
- Add outputs for resource URLs/ARNs that backend or deployment setup needs.

## Local Checks

Useful commands:

```bash
npm run check
```

```bash
python aws-client/dynamodb/create_tables.py
```

```bash
./infra/lambda/responder-agent-lambda/bundle.sh
./infra/lambda/product-update-lambda/bundle.sh
./infra/lambda/post-debrief-lambda/bundle.sh
```

Run Lambda bundle scripts from the repo root or directly from each Lambda directory. They create ignored `function.zip` artifacts beside each Lambda.

## Repo Hygiene

- Keep generated artifacts out of git: `function.zip`, Python caches, local venvs, logs, and `.env` files are ignored.
- Keep code and infrastructure changes together when they depend on each other.
- Prefer small, explicit modules over large route handlers or Lambda files that mix validation, AWS calls, and business logic.
- Before pushing infrastructure-related changes, check `git status --ignored --short infra aws-client` to confirm only intended files are tracked.
