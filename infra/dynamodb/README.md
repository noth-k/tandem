# DynamoDB infra (demo)

This folder contains a small Python script to create the DynamoDB tables used by the live-commerce prototype, plus a sample data loader for BestDenki electronics.

## Prerequisites

- Python 3.8+
- `boto3` installed: `python3 -m pip install -r infra/dynamodb/requirements.txt`
- AWS credentials with permissions to create DynamoDB tables configured in your environment (e.g. `~/.aws/credentials` or environment variables)

## Create the tables

```bash
python3 -m pip install -r infra/dynamodb/requirements.txt
export AWS_REGION=us-east-1
# ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set, or use AWS_PROFILE
python3 infra/dynamodb/create_tables.py
```

## Populate sample BestDenki data

After the tables are created, load sample products, discounts, and chat messages:

```bash
python3 infra/dynamodb/populate_sample_data.py
```

## Link your code to DynamoDB

1) Set the AWS profile or credentials locally:

```bash
export AWS_REGION=ap-southeast-1
export AWS_PROFILE=hackathon
```

2) Use the helper functions in `infra/dynamodb/client.py`:

```python
from infra.dynamodb.client import (
    add_product_name,
    put_product,
    update_product,
    put_message,
    update_message,
    put_discount,
)

put_product('prod-123', {
    'name': 'Live Demo Shirt',
    'stockQty': 50,
    'priceCents': 2999,
    'currency': 'USD',
    'description': 'Lightweight streamer tee',
    'sku': 'LIVESHIRT-A',
    'platformIds': {'tiktok': 'TT123', 'shopee': 'SH123'},
    'tags': ['featured', 'new'],
    'isActive': True,
    'createdAt': '2026-06-06T12:00:00Z',
})
```

## Files

- `infra/dynamodb/create_tables.py` — script that creates the DynamoDB tables.
- `infra/dynamodb/populate_sample_data.py` — loads sample product, message, and discount data.
- `infra/dynamodb/client.py` — reusable helper functions for connecting to DynamoDB and writing items.
- `infra/dynamodb/SCHEMA.md` — table schema reference.
- `infra/dynamodb/requirements.txt` — dependencies.

## Notes

- The sample loader writes 10 BestDenki-style electronics products.
- Messages are created for a live conversation context, and discounts are applied to two products.
- Use `create_tables.py` first; then run `populate_sample_data.py`.
