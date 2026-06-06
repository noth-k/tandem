#!/usr/bin/env python3
"""Simulate parsed seller speech events into the Discounts table.

This stands in for the audio parser during testing. Each event represents a
seller utterance that has already been parsed into structured discount data.

Usage:
  python aws-client/dynamodb/simulate_audio_discounts.py
  python aws-client/dynamodb/simulate_audio_discounts.py --delay 2 --clear-first
"""

import argparse
import os
import sys
import time
from datetime import datetime, timedelta, timezone

# Ensure the aws-client root is on sys.path when running this file directly.
AWS_CLIENT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if AWS_CLIENT_ROOT not in sys.path:
    sys.path.insert(0, AWS_CLIENT_ROOT)

from dynamodb.client import get_table, put_discount


DISCOUNT_EVENTS = [
    {
        'discountId': 'disc-serum-flash-4-off',
        'productId': 'serum',
        'sellerTranscript': 'For the next ten minutes only, I am dropping the Glow Serum from sixteen ninety to twelve ninety.',
        'valueAmount': 4.00,
        'durationMinutes': 10,
    },
    {
        'discountId': 'disc-lip-bundle-clip',
        'productId': 'lip',
        'sellerTranscript': 'Bundle time, grab any two lip tints and I will throw in a ceramic hair clip for free.',
        'valueAmount': 3.20,
        'durationMinutes': 15,
    },
    {
        'discountId': 'disc-shirt-live-6-off',
        'productId': 'shirt',
        'sellerTranscript': 'The oversized linen shirt is live-only at eighteen dollars, down from twenty four.',
        'valueAmount': 6.00,
        'durationMinutes': 20,
    },
    {
        'discountId': 'disc-spf-low-stock-bundle',
        'productId': 'spf',
        'sellerTranscript': 'Add the SPF50 gel with any serum order and I will unlock free shipping for this live.',
        'valueAmount': 1.50,
        'durationMinutes': 10,
    },
    {
        'discountId': 'disc-clip-free-with-lip',
        'productId': 'clip',
        'sellerTranscript': 'The ceramic hair clip is free when you buy two lip tints during the bundle window.',
        'valueAmount': 3.20,
        'durationMinutes': 15,
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
