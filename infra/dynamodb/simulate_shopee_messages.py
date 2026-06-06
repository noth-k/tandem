#!/usr/bin/env python3
"""Simulate incoming Shopee Live buyer messages into the Messages table.

Usage:
  python infra/dynamodb/simulate_shopee_messages.py
  python infra/dynamodb/simulate_shopee_messages.py --delay 1.5 --clear-first
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

from infra.dynamodb.client import get_table, put_message
from boto3.dynamodb.conditions import Key


CONVERSATION_ID = 'shopee-live-electronics-001'

MESSAGE_EVENTS = [
    {
        'buyerId': 'buyer-001',
        'buyerUsername': 'tech_afiq',
        'messageText': 'is this charged using a USB-C charger?',
        'productId': 'anker-737-power-bank',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-002',
        'buyerUsername': 'sg_gadgetmom',
        'messageText': 'will there be a discount later?',
        'productId': 'airpods-pro-2-usbc',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-003',
        'buyerUsername': 'nurul_bytes',
        'messageText': 'can the MacBook Air handle video editing for school?',
        'productId': 'macbook-air-m2-13-512',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-004',
        'buyerUsername': 'kai_switch',
        'messageText': 'Nintendo Switch OLED got local warranty?',
        'productId': 'nintendo-switch-oled-white',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-005',
        'buyerUsername': 'jess_camera',
        'messageText': 'Is the GoPro waterproof without the case?',
        'productId': 'gopro-hero12-black',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-006',
        'buyerUsername': 'daniel_s24',
        'messageText': 'If I buy Galaxy S24 now can ship today?',
        'productId': 'samsung-galaxy-s24-256',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-007',
        'buyerUsername': 'audio_lina',
        'messageText': 'Sony XM5 better than AirPods for noise cancelling?',
        'productId': 'sony-wh-1000xm5-black',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-008',
        'buyerUsername': 'tablet_hunter',
        'messageText': 'does Tab S9 come with S Pen in the box?',
        'productId': 'samsung-galaxy-tab-s9-256',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-009',
        'buyerUsername': 'appledealz',
        'messageText': 'Any bundle if I get iPad Pro and AirPods together?',
        'productId': 'ipad-pro-12-9-m2',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-010',
        'buyerUsername': 'mira_live',
        'messageText': 'How many iPad Air left? Need one for work.',
        'productId': 'ipad-air-m1-256',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-011',
        'buyerUsername': 'fastcheckout',
        'messageText': 'I want the Anker power bank, where to checkout?',
        'productId': 'anker-737-power-bank',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-012',
        'buyerUsername': 'spammy_deals',
        'messageText': 'follow me for free phones!!!',
        'productId': '',
        'sourcePlatform': 'shopee',
    },
]


def iso_at(offset_seconds: int) -> str:
    return (
        datetime.now(timezone.utc) + timedelta(seconds=offset_seconds)
    ).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def clear_messages(conversation_id: str) -> int:
    table = get_table('Messages')
    deleted = 0
    response = table.query(
        KeyConditionExpression=Key('conversationId').eq(conversation_id)
    )
    with table.batch_writer() as batch:
        while True:
            for item in response.get('Items', []):
                batch.delete_item(
                    Key={
                        'conversationId': item['conversationId'],
                        'messageTimestamp': item['messageTimestamp'],
                    }
                )
                deleted += 1
            last_key = response.get('LastEvaluatedKey')
            if not last_key:
                break
            response = table.query(
                KeyConditionExpression=Key('conversationId').eq(conversation_id),
                ExclusiveStartKey=last_key,
            )
    return deleted


def main():
    parser = argparse.ArgumentParser(description='Stream simulated Shopee Live messages into DynamoDB.')
    parser.add_argument('--conversation-id', default=CONVERSATION_ID)
    parser.add_argument('--delay', type=float, default=0.0, help='Seconds to wait between messages.')
    parser.add_argument('--clear-first', action='store_true', help='Delete existing messages for this conversation before streaming.')
    args = parser.parse_args()

    if args.clear_first:
        deleted = clear_messages(args.conversation_id)
        print(f'Cleared {deleted} existing messages for {args.conversation_id}.')

    for index, event in enumerate(MESSAGE_EVENTS, start=1):
        timestamp = iso_at(index)
        item = {
            'messageId': f'msg-{index:03d}',
            **event,
            'aiCategory': 'UNCLASSIFIED',
            'aiResponse': '',
            'replySent': False,
            'priority': 0,
            'escalated': False,
            'createdAt': timestamp,
        }
        put_message(args.conversation_id, timestamp, item)
        print(f'[{index:02d}/{len(MESSAGE_EVENTS)}] @{event["buyerUsername"]}: {event["messageText"]}')
        if args.delay > 0 and index < len(MESSAGE_EVENTS):
            time.sleep(args.delay)

    print(f'Shopee message stream complete: {len(MESSAGE_EVENTS)} messages written.')


if __name__ == '__main__':
    main()
