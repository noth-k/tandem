#!/usr/bin/env python3
"""Clear stream-runtime DynamoDB tables used during testing.

This deletes data from Messages and Discounts only. It intentionally leaves
Products and ProductNames untouched because those are seller preset catalog data.

Usage:
  python aws-client/dynamodb/clear_runtime_tables.py --yes
"""

import argparse
import os
import sys

# Ensure the aws-client root is on sys.path when running this file directly.
AWS_CLIENT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if AWS_CLIENT_ROOT not in sys.path:
    sys.path.insert(0, AWS_CLIENT_ROOT)

from dynamodb.client import get_table


RUNTIME_TABLE_KEYS = {
    'Messages': ('conversationId', 'messageTimestamp'),
    'Discounts': ('productId', 'startAt'),
}


def clear_table(table_name: str, key_names: tuple[str, str]) -> int:
    table = get_table(table_name)
    deleted = 0
    projection = ', '.join(key_names)
    response = table.scan(ProjectionExpression=projection)

    with table.batch_writer() as batch:
        while True:
            for item in response.get('Items', []):
                batch.delete_item(Key={key: item[key] for key in key_names})
                deleted += 1

            last_key = response.get('LastEvaluatedKey')
            if not last_key:
                break

            response = table.scan(
                ProjectionExpression=projection,
                ExclusiveStartKey=last_key,
            )

    return deleted


def main():
    parser = argparse.ArgumentParser(description='Clear Messages and Discounts test data.')
    parser.add_argument('--yes', action='store_true', help='Required confirmation for deletion.')
    args = parser.parse_args()

    if not args.yes:
        raise SystemExit('Refusing to clear runtime tables without --yes.')

    for table_name, key_names in RUNTIME_TABLE_KEYS.items():
        deleted = clear_table(table_name, key_names)
        print(f'Cleared {deleted} items from {table_name}.')

    print('Runtime table clear complete. Product catalog tables were not touched.')


if __name__ == '__main__':
    main()
