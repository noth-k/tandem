#!/usr/bin/env python3
"""Populate seller-owned DynamoDB catalog tables for the live-commerce demo.

Only Products and ProductNames are seeded here. Runtime tables such as Messages
and Discounts should start empty and be populated as stream events arrive.
"""

import os
import sys
from datetime import datetime, timezone

# Ensure the aws-client root is on sys.path when running this file directly.
AWS_CLIENT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if AWS_CLIENT_ROOT not in sys.path:
    sys.path.insert(0, AWS_CLIENT_ROOT)

from dynamodb.client import add_product_name, get_table, put_product


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def clear_table(table_name: str, key_names: list[str]) -> int:
    table = get_table(table_name)
    deleted = 0
    expression_attribute_names = {f'#k{index}': key for index, key in enumerate(key_names)}
    projection_expression = ', '.join(expression_attribute_names.keys())
    response = table.scan(
        ProjectionExpression=projection_expression,
        ExpressionAttributeNames=expression_attribute_names,
    )

    with table.batch_writer() as batch:
        while True:
            for item in response.get('Items', []):
                batch.delete_item(Key={key: item[key] for key in key_names})
                deleted += 1

            last_key = response.get('LastEvaluatedKey')
            if not last_key:
                break

            response = table.scan(
                ProjectionExpression=projection_expression,
                ExpressionAttributeNames=expression_attribute_names,
                ExclusiveStartKey=last_key,
            )

    return deleted


def main():
    now = iso_now()
    products = [
        {
            'productId': 'serum',
            'name': 'Hyaluronic Glow Serum 30ml',
            'isCurrent': True,
            'stockQty': 38,
            'price': 12.90,
            'wasPrice': 16.90,
            'currency': 'SGD',
            'description': 'Lightweight hyaluronic acid serum for dewy hydration and fast-absorbing glow.',
            'sku': 'GLOW-SERUM-HA-30ML',
            'platformIds': {'shopee': 'GL-HA-SERUM'},
            'tags': ['skincare', 'serum', 'bestseller', 'hydrating'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'lip',
            'name': 'Rhode Lip Tint',
            'isCurrent': False,
            'stockQty': 120,
            'price': 6.50,
            'wasPrice': 6.50,
            'currency': 'SGD',
            'description': 'Transfer-resistant and moisturizing lip tint with a glossy finish.',
            'sku': 'GLOW-LIP-RHODE',
            'platformIds': {'shopee': 'GL-LIP-RHODE'},
            'tags': ['beauty', 'lip tint', 'rhode', 'bundle'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'shirt',
            'name': 'Oversized Linen Shirt - Sand',
            'isCurrent': False,
            'stockQty': 11,
            'price': 18.00,
            'wasPrice': 24.00,
            'currency': 'SGD',
            'description': 'Relaxed oversized linen shirt in sand, with limited stock during the live.',
            'sku': 'GLOW-LINEN-SHIRT-SAND',
            'platformIds': {'shopee': 'GL-LINEN-SAND'},
            'tags': ['fashion', 'linen', 'low-stock'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'clip',
            'name': 'Ceramic Hair Claw Clip',
            'isCurrent': False,
            'stockQty': 240,
            'price': 3.20,
            'wasPrice': 3.20,
            'currency': 'SGD',
            'description': 'Glossy ceramic hair claw clip, featured as a free gift in the lip tint bundle.',
            'sku': 'GLOW-CLIP-CERAMIC',
            'platformIds': {'shopee': 'GL-CERAMIC-CLIP'},
            'tags': ['beauty accessory', 'hair clip', 'bundle gift'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'spf',
            'name': 'Daily SPF50 Sunscreen Gel',
            'isCurrent': False,
            'stockQty': 64,
            'price': 9.90,
            'wasPrice': 9.90,
            'currency': 'SGD',
            'description': 'Non-sticky SPF50 gel sunscreen with no white cast and a matte finish.',
            'sku': 'GLOW-SPF50-GEL',
            'platformIds': {'shopee': 'GL-SPF50-GEL'},
            'tags': ['skincare', 'sunscreen', 'spf', 'low-stock'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
    ]

    print('Clearing existing product catalog...')
    deleted_products = clear_table('Products', ['productId'])
    deleted_names = clear_table('ProductNames', ['name', 'productId'])
    print(f'Cleared {deleted_products} products and {deleted_names} product-name rows.')

    print('Writing product catalog...')
    for product in products:
        product_id = product['productId']
        put_product(product_id, {k: v for k, v in product.items() if k != 'productId'})
        add_product_name(product['name'], product_id)

    print(f'Catalog population complete: {len(products)} products written.')
    print('Messages and Discounts were intentionally not populated.')


if __name__ == '__main__':
    main()
