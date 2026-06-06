# DynamoDB infra (demo)

This folder contains a small Python script to create the DynamoDB tables used by the hackathon prototype.

Prerequisites

- Python 3.8+
- `boto3` installed: `pip install boto3`
- AWS credentials with permissions to create DynamoDB tables configured in your environment (e.g. `~/.aws/credentials` or environment variables).

Create the tables

```bash
python3 -m pip install -r infra/dynamodb/requirements.txt
export AWS_REGION=us-east-1
# ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set (or use an AWS profile)
python3 infra/dynamodb/create_tables.py
```

Team setup

If your teammates clone this repo, they can run:

```bash
cd /path/to/tandem
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r infra/dynamodb/requirements.txt
export AWS_REGION=us-east-1
export AWS_PROFILE=hackathon   # or use AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY directly
python3 infra/dynamodb/create_tables.py
```

Link your code to DynamoDB

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

# create or update a product
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

# update an existing product attribute
update_product('prod-123', {'stockQty': 45, 'updatedAt': '2026-06-06T12:30:00Z'})

# add a chat message
put_message('stream-abc', '2026-06-06T12:31:00Z', {
    'messageId': 'msg-001',
    'buyerId': 'buyer-123',
    'buyerUsername': 'shopper1',
    'messageText': 'Does this come in blue?',
    'aiCategory': 'QUESTION',
    'aiResponse': 'Yes, it is available in blue and black.',
    'replySent': True,
    'priority': 5,
    'escalated': False,
    'createdAt': '2026-06-06T12:31:00Z',
})

# create a discount
put_discount('prod-123', 1717648260000, {
    'discountId': 'disc-001',
    'valuePercent': 15,
    'startAt': 1717648260000,
    'endAt': 1717651860000,
    'acceptedBySeller': True,
    'appliedBy': 'audio-parser',
    'createdAt': '2026-06-06T12:32:00Z',
})
```

Files

- [infra/dynamodb/create_tables.py](infra/dynamodb/create_tables.py) — script that creates the tables.
- [infra/dynamodb/client.py](infra/dynamodb/client.py) — helper functions for reading and writing table items.
- [infra/dynamodb/SCHEMA.md](infra/dynamodb/SCHEMA.md) — schema reference.

Next steps

- Run the script to create tables in your AWS account for the demo.
- Optionally convert the script to CloudFormation, Terraform or CDK for more production-ready provisioning.
