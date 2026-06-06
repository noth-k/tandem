#!/usr/bin/env python3
"""Populate seller-owned DynamoDB catalog tables for the live-commerce demo.

Only Products and ProductNames are seeded here. Runtime tables such as Messages
and Discounts should start empty and be populated as stream events arrive.
"""

import os
import sys
from datetime import datetime, timezone

# Ensure the repo root is on sys.path when running this file directly.
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from infra.dynamodb.client import add_product_name, put_product


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def main():
    now = iso_now()
    products = [
        {
            'productId': 'ipad-pro-12-9-m2',
            'name': 'iPad Pro 12.9 M2 512GB',
            'stockQty': 18,
            'price': 1399.00,
            'currency': 'SGD',
            'description': '12.9-inch Liquid Retina XDR display, M2 chip, Wi-Fi, 512GB storage.',
            'sku': 'ELEC-APPLE-IPADPRO129-M2-512',
            'platformIds': {'shopee': 'SP-IPADPRO129'},
            'tags': ['tablet', 'apple', 'pro'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'ipad-air-m1-256',
            'name': 'iPad Air M1 256GB',
            'stockQty': 26,
            'price': 749.00,
            'currency': 'SGD',
            'description': '10.9-inch Liquid Retina display, M1 chip, Wi-Fi, 256GB storage.',
            'sku': 'ELEC-APPLE-IPADAIR-M1-256',
            'platformIds': {'shopee': 'SP-IPADAIR'},
            'tags': ['tablet', 'apple', 'midrange'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'airpods-pro-2-usbc',
            'name': 'AirPods Pro 2 USB-C',
            'stockQty': 84,
            'price': 249.00,
            'currency': 'SGD',
            'description': 'Wireless earbuds with active noise cancellation, transparency mode, and USB-C MagSafe case.',
            'sku': 'ELEC-APPLE-AIRPODSPRO2-USBC',
            'platformIds': {'shopee': 'SP-AIRPODSPRO2'},
            'tags': ['audio', 'earbuds', 'apple'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'macbook-air-m2-13-512',
            'name': 'MacBook Air M2 13-inch 512GB',
            'stockQty': 14,
            'price': 1199.00,
            'currency': 'SGD',
            'description': '13.6-inch laptop with M2 chip, 16GB memory, and 512GB SSD.',
            'sku': 'ELEC-APPLE-MBA-M2-13-512',
            'platformIds': {'shopee': 'SP-MBA13M2'},
            'tags': ['laptop', 'apple', 'ultrabook'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'samsung-galaxy-s24-256',
            'name': 'Samsung Galaxy S24 256GB',
            'stockQty': 31,
            'price': 999.00,
            'currency': 'SGD',
            'description': 'Flagship Android phone with Galaxy AI features, triple camera, and 256GB storage.',
            'sku': 'ELEC-SAMSUNG-S24-256',
            'platformIds': {'shopee': 'SP-GALAXYS24'},
            'tags': ['phone', 'android', 'samsung'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'samsung-galaxy-tab-s9-256',
            'name': 'Samsung Galaxy Tab S9 256GB',
            'stockQty': 22,
            'price': 899.00,
            'currency': 'SGD',
            'description': '11-inch Dynamic AMOLED 2X tablet with S Pen and 256GB storage.',
            'sku': 'ELEC-SAMSUNG-TABS9-256',
            'platformIds': {'shopee': 'SP-TABS9'},
            'tags': ['tablet', 'android', 'samsung'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'sony-wh-1000xm5-black',
            'name': 'Sony WH-1000XM5 Headphones',
            'stockQty': 48,
            'price': 349.00,
            'currency': 'SGD',
            'description': 'Wireless over-ear headphones with adaptive noise cancellation and long battery life.',
            'sku': 'ELEC-SONY-WH1000XM5-BLK',
            'platformIds': {'shopee': 'SP-WH1000XM5'},
            'tags': ['audio', 'headphones', 'sony'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'nintendo-switch-oled-white',
            'name': 'Nintendo Switch OLED White',
            'stockQty': 37,
            'price': 349.00,
            'currency': 'SGD',
            'description': 'Nintendo Switch console with 7-inch OLED screen, white Joy-Con controllers, and 64GB storage.',
            'sku': 'ELEC-NINTENDO-SWITCHOLED-WHT',
            'platformIds': {'shopee': 'SP-SWITCHOLED'},
            'tags': ['gaming', 'console', 'nintendo'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'gopro-hero12-black',
            'name': 'GoPro HERO12 Black',
            'stockQty': 19,
            'price': 499.00,
            'currency': 'SGD',
            'description': 'Waterproof action camera with 5.3K video, HyperSmooth stabilization, and improved battery life.',
            'sku': 'ELEC-GOPRO-HERO12-BLK',
            'platformIds': {'shopee': 'SP-HERO12'},
            'tags': ['camera', 'action', 'gopro'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
        {
            'productId': 'anker-737-power-bank',
            'name': 'Anker 737 Power Bank 24000mAh',
            'stockQty': 65,
            'price': 189.00,
            'currency': 'SGD',
            'description': 'High-capacity portable charger with 140W USB-C fast charging and smart digital display.',
            'sku': 'ELEC-ANKER-737-PB24K',
            'platformIds': {'shopee': 'SP-ANKER737'},
            'tags': ['accessory', 'charger', 'anker'],
            'isActive': True,
            'createdAt': now,
            'updatedAt': now,
        },
    ]

    print('Writing product catalog...')
    for product in products:
        product_id = product['productId']
        put_product(product_id, {k: v for k, v in product.items() if k != 'productId'})
        add_product_name(product['name'], product_id)

    print(f'Catalog population complete: {len(products)} products written.')
    print('Messages and Discounts were intentionally not populated.')


if __name__ == '__main__':
    main()
