#!/usr/bin/env python3
"""Simulate parsed seller speech events into the Discounts table.

This stands in for the audio parser during testing. Each event represents a
seller utterance that has already been parsed into structured discount data.

Usage:
  python infra/dynamodb/simulate_audio_discounts.py
  python infra/dynamodb/simulate_audio_discounts.py --delay 2 --clear-first
"""

import argparse
import os
import sys
import time
from datetime import datetime, timedelta, timezone

# Ensure the repo root is on sys.path when running this file directly.
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from infra.dynamodb.client import get_table, put_discount


DISCOUNT_EVENTS = [
    {
        'discountId': 'disc-anker-737-flash-10',
        'productId': 'anker-737-power-bank',
        'sellerTranscript': 'For the next ten minutes, take 10 percent off the Anker 737 power bank.',
        'valuePercent': 10,
        'durationMinutes': 10,
    },
    {
        'discountId': 'disc-airpods-pro-2-25-off',
        'productId': 'airpods-pro-2-usbc',
        'sellerTranscript': 'AirPods Pro 2, I can do twenty five dollars off for viewers in this live.',
        'valueAmount': 25.00,
        'durationMinutes': 12,
    },
    {
        'discountId': 'disc-s24-flash-8',
        'productId': 'samsung-galaxy-s24-256',
        'sellerTranscript': 'Galaxy S24 flash deal, eight percent off for the next 5 minutes.',
        'valuePercent': 8,
        'durationMinutes': 15,
    },
    {
        'discountId': 'disc-switch-oled-20-off',
        'productId': 'nintendo-switch-oled-white',
        'sellerTranscript': 'Nintendo Switch OLED gets twenty dollars off for the next batch of buyers.',
        'valueAmount': 20.00,
        'durationMinutes': 10,
    },
    {
        'discountId': 'disc-macbook-air-m2-5',
        'productId': 'macbook-air-m2-13-512',
        'sellerTranscript': 'If you are checking out the MacBook Air M2 today, I am unlocking five percent off.',
        'valuePercent': 5,
        'durationMinutes': 20,
    },
]


def epoch_ms(offset_seconds: int = 0) -> int:
    return int((datetime.now(timezone.utc) + timedelta(seconds=offset_seconds)).timestamp() * 1000)


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def clear_discounts() -> int:
    table = get_table('Discounts')
    deleted = 0
    response = table.scan(ProjectionExpression='productId, startAt')
    with table.batch_writer() as batch:
        while True:
            for item in response.get('Items', []):
                batch.delete_item(Key={'productId': item['productId'], 'startAt': item['startAt']})
                deleted += 1
            last_key = response.get('LastEvaluatedKey')
            if not last_key:
                break
            response = table.scan(
                ProjectionExpression='productId, startAt',
                ExclusiveStartKey=last_key,
            )
    return deleted


def main():
    parser = argparse.ArgumentParser(description='Stream simulated parsed seller discounts into DynamoDB.')
    parser.add_argument('--delay', type=float, default=0.0, help='Seconds to wait between discount events.')
    parser.add_argument('--clear-first', action='store_true', help='Delete existing discounts before streaming.')
    args = parser.parse_args()

    if args.clear_first:
        deleted = clear_discounts()
        print(f'Cleared {deleted} existing discounts.')

    base_offset = 0
    for index, event in enumerate(DISCOUNT_EVENTS, start=1):
        start_at = epoch_ms(base_offset + index)
        end_at = start_at + int(event['durationMinutes'] * 60 * 1000)
        item = {
            'discountId': event['discountId'],
            'valueAmount': event.get('valueAmount', 0),
            'valuePercent': event.get('valuePercent', 0),
            'endAt': end_at,
            'acceptedBySeller': True,
            'appliedBy': 'audio-parser-simulator',
            'sourcePlatform': 'shopee',
            'sellerTranscript': event['sellerTranscript'],
            'parseConfidence': 0.94,
            'createdAt': iso_now(),
        }
        put_discount(event['productId'], start_at, item)
        print(f'[{index:02d}/{len(DISCOUNT_EVENTS)}] {event["productId"]}: {event["sellerTranscript"]}')
        if args.delay > 0 and index < len(DISCOUNT_EVENTS):
            time.sleep(args.delay)

    print(f'Discount stream complete: {len(DISCOUNT_EVENTS)} discounts written.')


if __name__ == '__main__':
    main()
