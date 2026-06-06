#!/usr/bin/env python3
"""Populate DynamoDB tables with sample electronics data."""

import os
import sys
import time
from datetime import datetime, timedelta

# Ensure the repo root is on sys.path when running this file directly.
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from infra.dynamodb.client import (
    add_product_name,
    put_discount,
    put_message,
    put_product,
)


def iso_now(offset_seconds: int = 0) -> str:
    return (datetime.utcnow() + timedelta(seconds=offset_seconds)).isoformat(timespec='seconds') + 'Z'


def epoch_ms(offset_seconds: int = 0) -> int:
    return int((datetime.utcnow() + timedelta(seconds=offset_seconds)).timestamp() * 1000)


def main():
    products = [
        {
            'productId': 'ipad-pro-12-9',
            'name': 'iPad Pro 12.9"',
            'stockQty': 45,
            'priceCents': 139900,
            'currency': 'USD',
            'description': '12.9-inch Liquid Retina XDR display, M2 chip, 512GB storage.',
            'sku': 'BD-IPADI2-512',
            'platformIds': {'tiktok': 'BDIPP-01', 'shopee': 'BDIPP-01'},
            'tags': ['tablet', 'pro', 'apple'],
            'isActive': True,
            'createdAt': iso_now(-3600),
        },
        {
            'productId': 'ipad-air',
            'name': 'iPad Air',
            'stockQty': 62,
            'priceCents': 74900,
            'currency': 'USD',
            'description': '10.9-inch display, M1 chip, 256GB storage, space gray.',
            'sku': 'BD-IPADA1-256',
            'platformIds': {'tiktok': 'BDIPA-01', 'shopee': 'BDIPA-01'},
            'tags': ['tablet', 'midrange', 'apple'],
            'isActive': True,
            'createdAt': iso_now(-3600),
        },
        {
            'productId': 'airpods-pro-2',
            'name': 'AirPods Pro 2',
            'stockQty': 85,
            'priceCents': 24900,
            'currency': 'USD',
            'description': 'Active noise cancellation, adaptive transparency, MagSafe case.',
            'sku': 'BD-AP2P',
            'platformIds': {'tiktok': 'BDAP2-01', 'shopee': 'BDAP2-01'},
            'tags': ['audio', 'wireless', 'apple'],
            'isActive': True,
            'createdAt': iso_now(-3600),
        },
        {
            'productId': 'macbook-air-m2',
            'name': 'MacBook Air M2',
            'stockQty': 28,
            'priceCents': 119900,
            'currency': 'USD',
            'description': '13.6-inch display, M2 chip, 16GB RAM, 512GB SSD.',
            'sku': 'BD-MBA2-512',
            'platformIds': {'tiktok': 'BDMBA-01', 'shopee': 'BDMBA-01'},
            'tags': ['laptop', 'apple', 'ultrabook'],
            'isActive': True,
            'createdAt': iso_now(-3600),
        },
        {
            'productId': 'samsung-galaxy-tab-s9',
            'name': 'Samsung Galaxy Tab S9',
            'stockQty': 36,
            'priceCents': 89900,
            'currency': 'USD',
            'description': '11-inch AMOLED display, Snapdragon processor, 256GB storage.',
            'sku': 'BD-SGST9',
            'platformIds': {'tiktok': 'BDGST9-01', 'shopee': 'BDGST9-01'},
            'tags': ['tablet', 'android', 'samsung'],
            'isActive': True,
            'createdAt': iso_now(-3600),
        },
        {
            'productId': 'sony-wh-1000xm5',
            'name': 'Sony WH-1000XM5',
            'stockQty': 54,
            'priceCents': 34900,
            'currency': 'USD',
            'description': 'Industry-leading noise cancellation wireless headphones.',
            'sku': 'BD-SWHXM5',
            'platformIds': {'tiktok': 'BDSWH-01', 'shopee': 'BDSWH-01'},
            'tags': ['audio', 'headphones', 'sony'],
            'isActive': True,
            'createdAt': iso_now(-3600),
        },
        {
            'productId': 'apple-watch-series-9',
            'name': 'Apple Watch Series 9',
            'stockQty': 38,
            'priceCents': 39900,
            'currency': 'USD',
            'description': '45mm GPS + Cellular, blood oxygen, ECG, road-ready fitness tracker.',
            'sku': 'BD-AW9-45',
            'platformIds': {'tiktok': 'BDAW9-01', 'shopee': 'BDAW9-01'},
            'tags': ['wearable', 'apple', 'fitness'],
            'isActive': True,
            'createdAt': iso_now(-3600),
        },
        {
            'productId': 'nintendo-switch-oleo',
            'name': 'Nintendo Switch OLED',
            'stockQty': 41,
            'priceCents': 34900,
            'currency': 'USD',
            'description': '7-inch OLED screen, enhanced audio, 64GB storage.',
            'sku': 'BD-NSOLED',
            'platformIds': {'tiktok': 'BDSWO-01', 'shopee': 'BDSWO-01'},
            'tags': ['gaming', 'nintendo', 'console'],
            'isActive': True,
            'createdAt': iso_now(-3600),
        },
        {
            'productId': 'go-pro-hero-12',
            'name': 'GoPro HERO12',
            'stockQty': 29,
            'priceCents': 49900,
            'currency': 'USD',
            'description': '5.3K video, HyperSmooth 6, waterproof action camera.',
            'sku': 'BD-GPH12',
            'platformIds': {'tiktok': 'BDGPH-01', 'shopee': 'BDGPH-01'},
            'tags': ['camera', 'action', 'gopro'],
            'isActive': True,
            'createdAt': iso_now(-3600),
        },
        {
            'productId': 'dyson-v15',
            'name': 'Dyson V15 Vacuum',
            'stockQty': 17,
            'priceCents': 69900,
            'currency': 'USD',
            'description': 'Cordless stick vacuum with laser dust detection and powerful suction.',
            'sku': 'BD-DV15',
            'platformIds': {'tiktok': 'BDD15-01', 'shopee': 'BDD15-01'},
            'tags': ['home', 'vacuum', 'dyson'],
            'isActive': True,
            'createdAt': iso_now(-3600),
        },
    ]

    discounts = [
        {
            'productId': 'ipad-pro-12-9',
            'startAt': epoch_ms(-1800),
            'discountId': 'disc-ipad-pro-15',
            'valuePercent': 15,
            'startAt': epoch_ms(-1800),
            'endAt': epoch_ms(3600),
            'acceptedBySeller': True,
            'appliedBy': 'audio-parser',
            'createdAt': iso_now(-1800),
        },
        {
            'productId': 'airpods-pro-2',
            'startAt': epoch_ms(-900),
            'discountId': 'disc-airpods-10',
            'valuePercent': 10,
            'startAt': epoch_ms(-900),
            'endAt': epoch_ms(5400),
            'acceptedBySeller': True,
            'appliedBy': 'audio-parser',
            'createdAt': iso_now(-900),
        },
    ]

    messages = [
        {
            'conversationId': 'live-001',
            'messageTimestamp': iso_now(-120),
            'messageId': 'msg-001',
            'buyerId': 'buyer-001',
            'buyerUsername': 'tech_lover88',
            'messageText': 'Is the iPad Pro 12.9 still available today?',
            'aiCategory': 'PRODUCT_QUERY',
            'aiResponse': '',
            'replySent': False,
            'priority': 8,
            'escalated': False,
            'createdAt': iso_now(-120),
        },
        {
            'conversationId': 'live-001',
            'messageTimestamp': iso_now(-90),
            'messageId': 'msg-002',
            'buyerId': 'buyer-002',
            'buyerUsername': 'audiofan',
            'messageText': 'Do the AirPods Pro 2 support ANC in low latency mode?',
            'aiCategory': 'FUNCTIONAL_QUERY',
            'aiResponse': '',
            'replySent': False,
            'priority': 6,
            'escalated': False,
            'createdAt': iso_now(-90),
        },
        {
            'conversationId': 'live-001',
            'messageTimestamp': iso_now(-60),
            'messageId': 'msg-003',
            'buyerId': 'buyer-003',
            'buyerUsername': 'gadgetqueen',
            'messageText': 'What is the best bundle price for the MacBook Air M2?',
            'aiCategory': 'PURCHASE_INTENT',
            'aiResponse': '',
            'replySent': False,
            'priority': 9,
            'escalated': False,
            'createdAt': iso_now(-60),
        },
    ]

    print('Writing sample products...')
    for product in products:
        put_product(product['productId'], {k: v for k, v in product.items() if k != 'productId'})
        add_product_name(product['name'], product['productId'])

    print('Writing sample discounts...')
    for discount in discounts:
        product_id = discount['productId']
        start_at = discount['startAt']
        discount_item = {k: v for k, v in discount.items() if k not in ('productId', 'startAt')}
        put_discount(product_id, start_at, discount_item)

    print('Writing sample messages...')
    for message in messages:
        convo_id = message.pop('conversationId')
        ts = message.pop('messageTimestamp')
        put_message(convo_id, ts, message)

    print('Sample data population complete.')


if __name__ == '__main__':
    main()
