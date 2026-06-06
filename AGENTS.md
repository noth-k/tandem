# AGENTS.md

Guidance for AI coding agents working in this repository.

## Architecture Overview

This repo is the Tandem backend for a live-commerce AI co-host demo. It has three main areas:

- `src/`: Node.js/Express backend routes and service logic.
- `infra/`: deployable AWS infrastructure, including CloudFormation templates and Lambda source.
- `aws-client/`: reusable AWS helper/client code for local scripts or backend integrations.

The backend is the API boundary for the app. AWS infrastructure handles async processing and persistence-oriented work. Keep those boundaries clear when adding new features.

## High-Level Flow

The system is shaped around live-commerce events:

- Chat or buyer events enter the backend.
- The backend may respond synchronously for demo routes, or enqueue work to SQS for async handling.
- SQS queues trigger Lambda functions.
- Lambdas process events, call AI/business logic as needed, and read/write AWS data stores.
- Some post-stream work can be handled through a Lambda Function URL.

Current async infrastructure:

- `chat-queue` is intended for buyer/chat events.
- `product-details-queue` is intended for product or inventory update events.
- `responder-agent-lambda` handles chat-response style work.
- `product-update-lambda` handles product update style work.
- `post-debrief-lambda` handles post-stream summary/debrief style work.

## Working With Backend Code

Backend code lives under `src/`.

- Keep route handlers thin.
- Put reusable logic in `src/services/`.
- Keep AWS SDK calls behind small service/client modules rather than scattering them through routes.
- Read AWS resource configuration from environment variables.
- Do not commit credentials, account-specific secrets, or local `.env` files.

When publishing to SQS from the backend, use stable JSON message envelopes with event type, IDs, timestamps, and the minimum context the Lambda needs. Prefer additive changes to message shapes so producers and consumers can evolve safely.

## Working With Infrastructure

CloudFormation lives in `infra/cloudformation/`.

Lambda source lives in `infra/lambda/<function-name>/`. Each Lambda currently has:

- `index.py`
- `requirements.txt`
- `bundle.sh`

Generated Lambda zips are build artifacts and should not be committed.

When changing infrastructure:

- Keep CloudFormation, Lambda code, backend config, and documentation in sync.
- Update IAM permissions when a Lambda or backend integration needs a new AWS action.
- Keep resource names and environment variables consistent across CloudFormation and code.
- Preserve the project tagging conventions unless intentionally changing them.

## AWS Client Helpers

Reusable AWS helper code lives under `aws-client/`.

This directory is for shared scripts and client utilities, not automatically deployed Lambda code. If a Lambda needs shared helper code, package it deliberately through the Lambda bundle process or copy a small stable helper into that Lambda.

## Repo Hygiene

- Keep generated artifacts out of git: Lambda zips, Python caches, local virtualenvs, logs, and `.env` files.
- Keep deployable infra in `infra/`; do not recreate older root-level `cloudformation/` or `lambda/` directories.
- Keep reusable AWS client helpers in `aws-client/`.
- Before pushing infra-related changes, check the repo status carefully so generated artifacts are not accidentally tracked.

## Useful Checks

```bash
npm run check
```

```bash
./infra/lambda/responder-agent-lambda/bundle.sh
./infra/lambda/product-update-lambda/bundle.sh
./infra/lambda/post-debrief-lambda/bundle.sh
```
