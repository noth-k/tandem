#!/usr/bin/env python3
"""Create DynamoDB tables for the live-commerce AI co-host prototype.

Tables created:
- ProductNames: lookup from product name -> productId
- Products: product metadata, stock, price, description
- Messages: chat messages per conversation (buyer messages and AI fields)
- Discounts: per-product discount records

Run: `python infra/dynamodb/create_tables.py`
"""
import sys
import time
import boto3
from botocore.exceptions import ClientError


def table_exists(dynamodb, name):
    try:
        dynamodb.describe_table(TableName=name)
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            return False
        raise


def create_table(dynamodb, params):
    name = params['TableName']
    if table_exists(dynamodb, name):
        print(f"Table '{name}' already exists, skipping.")
        return
    print(f"Creating table '{name}'...")
    dynamodb.create_table(**params)
    # wait
    waiter = boto3.client('dynamodb').get_waiter('table_exists')
    waiter.wait(TableName=name)
    print(f"Table '{name}' created.")


def main():
    dynamodb = boto3.client('dynamodb')

    # ProductNames: simple lookup by name (allows duplicates with productId as sort key)
    create_table(dynamodb, {
        'TableName': 'ProductNames',
        'KeySchema': [
            {'AttributeName': 'name', 'KeyType': 'HASH'},
            {'AttributeName': 'productId', 'KeyType': 'RANGE'},
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'name', 'AttributeType': 'S'},
            {'AttributeName': 'productId', 'AttributeType': 'S'},
        ],
        'BillingMode': 'PAY_PER_REQUEST',
    })

    # Products: primary product record; GSI on `name` for lookups by product name
    create_table(dynamodb, {
        'TableName': 'Products',
        'KeySchema': [
            {'AttributeName': 'productId', 'KeyType': 'HASH'},
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'productId', 'AttributeType': 'S'},
            {'AttributeName': 'name', 'AttributeType': 'S'},
        ],
        'GlobalSecondaryIndexes': [
            {
                'IndexName': 'NameIndex',
                'KeySchema': [
                    {'AttributeName': 'name', 'KeyType': 'HASH'},
                ],
                'Projection': {'ProjectionType': 'ALL'},
            }
        ],
        'BillingMode': 'PAY_PER_REQUEST',
    })

    # Messages: partition by conversationId (e.g., stream or room), sort by iso timestamp
    create_table(dynamodb, {
        'TableName': 'Messages',
        'KeySchema': [
            {'AttributeName': 'conversationId', 'KeyType': 'HASH'},
            {'AttributeName': 'messageTimestamp', 'KeyType': 'RANGE'},
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'conversationId', 'AttributeType': 'S'},
            {'AttributeName': 'messageTimestamp', 'AttributeType': 'S'},
            {'AttributeName': 'buyerId', 'AttributeType': 'S'},
        ],
        'GlobalSecondaryIndexes': [
            {
                'IndexName': 'BuyerIndex',
                'KeySchema': [
                    {'AttributeName': 'buyerId', 'KeyType': 'HASH'},
                ],
                'Projection': {'ProjectionType': 'ALL'},
            }
        ],
        'BillingMode': 'PAY_PER_REQUEST',
    })

    # Discounts: multiple discounts per product; sort key by start timestamp allows history
    create_table(dynamodb, {
        'TableName': 'Discounts',
        'KeySchema': [
            {'AttributeName': 'productId', 'KeyType': 'HASH'},
            {'AttributeName': 'startAt', 'KeyType': 'RANGE'},
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'productId', 'AttributeType': 'S'},
            {'AttributeName': 'startAt', 'AttributeType': 'N'},
        ],
        'BillingMode': 'PAY_PER_REQUEST',
    })


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('Error:', exc, file=sys.stderr)
        raise
