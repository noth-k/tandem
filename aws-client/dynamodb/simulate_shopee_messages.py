#!/usr/bin/env python3
"""Simulate incoming Shopee Live buyer messages into the Messages table.

Usage:
  python aws-client/dynamodb/simulate_shopee_messages.py
  python aws-client/dynamodb/simulate_shopee_messages.py --delay 1.5 --clear-first
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

from dynamodb.client import get_table, put_message
from boto3.dynamodb.conditions import Key


CONVERSATION_ID = 'shopee-live-glowlab-001'

MESSAGE_EVENTS = [
    {
        'buyerId': 'buyer-001',
        'buyerUsername': 'jaymar_22',
        'messageText': 'how much is the serum sis?',
        'productId': 'serum',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-002',
        'buyerUsername': 'siti.rahma',
        'messageText': 'is the serum ok for oily acne skin?',
        'productId': 'serum',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-003',
        'buyerUsername': 'thuy_ng',
        'messageText': 'WHERE TO BUY?? link pls',
        'productId': 'serum',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-004',
        'buyerUsername': 'raj_kumar',
        'messageText': 'is this the authentic one or the fake batch going around?',
        'productId': 'serum',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-005',
        'buyerUsername': 'putri_dewi',
        'messageText': 'can you show the serum texture again?',
        'productId': 'serum',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-006',
        'buyerUsername': 'kevin_tan',
        'messageText': 'lipstick lasts how many hours?',
        'productId': 'lip',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-007',
        'buyerUsername': 'linh.dao',
        'messageText': 'does the linen shirt come in black? size M?',
        'productId': 'shirt',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-008',
        'buyerUsername': 'hana_idn',
        'messageText': 'can i get 20% off if i buy 2 serums?',
        'productId': 'serum',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-009',
        'buyerUsername': 'dewi_p',
        'messageText': 'is SPF50 sticky? i hate white cast',
        'productId': 'spf',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-010',
        'buyerUsername': 'ayu_w',
        'messageText': 'added serum + lip tint to cart checking out now',
        'productId': 'serum',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-011',
        'buyerUsername': 'grace.tan',
        'messageText': 'how much the hair clip alone?',
        'productId': 'clip',
        'sourcePlatform': 'shopee',
    },
    {
        'buyerId': 'buyer-012',
        'buyerUsername': 'spammy_deals',
        'messageText': 'follow me for free skincare!!!',
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
