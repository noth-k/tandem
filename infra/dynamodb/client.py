"""DynamoDB helper utilities for the live-commerce prototype.

This module provides simple helpers for connecting to the tables created in AWS and
for reading/writing item attributes in the `Products`, `Messages`, `Discounts`, and
`ProductNames` tables.
"""

from decimal import Decimal
from typing import Any, Dict, List, Optional

import boto3
from boto3.dynamodb.conditions import Key


def _convert_numbers(obj: Any) -> Any:
    """Recursively convert Python numbers into DynamoDB-safe values."""
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, int):
        return Decimal(obj)
    if isinstance(obj, dict):
        return {key: _convert_numbers(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [_convert_numbers(value) for value in obj]
    return obj


def get_dynamodb_resource(profile_name: Optional[str] = None, region_name: Optional[str] = None):
    session_kwargs = {}
    if profile_name:
        session_kwargs['profile_name'] = profile_name
    session = boto3.Session(**session_kwargs) if session_kwargs else boto3.Session()
    return session.resource('dynamodb', region_name=region_name)


def get_table(table_name: str, profile_name: Optional[str] = None, region_name: Optional[str] = None):
    dynamodb = get_dynamodb_resource(profile_name=profile_name, region_name=region_name)
    return dynamodb.Table(table_name)


def put_product(product_id: str, item: Dict[str, Any], profile_name: Optional[str] = None, region_name: Optional[str] = None):
    table = get_table('Products', profile_name=profile_name, region_name=region_name)
    item_with_id = {'productId': product_id, **item}
    item_with_id = _convert_numbers(item_with_id)
    return table.put_item(Item=item_with_id)


def update_product(product_id: str, updates: Dict[str, Any], profile_name: Optional[str] = None, region_name: Optional[str] = None):
    table = get_table('Products', profile_name=profile_name, region_name=region_name)
    update_expr = 'SET ' + ', '.join(f"{k} = :{k}" for k in updates.keys())
    expr_values = {f":{k}": _convert_numbers(v) for k, v in updates.items()}
    return table.update_item(
        Key={'productId': product_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
        ReturnValues='ALL_NEW',
    )


def get_product(product_id: str, profile_name: Optional[str] = None, region_name: Optional[str] = None):
    table = get_table('Products', profile_name=profile_name, region_name=region_name)
    response = table.get_item(Key={'productId': product_id})
    return response.get('Item')


def put_message(conversation_id: str, message_timestamp: str, item: Dict[str, Any], profile_name: Optional[str] = None, region_name: Optional[str] = None):
    table = get_table('Messages', profile_name=profile_name, region_name=region_name)
    item_with_keys = {'conversationId': conversation_id, 'messageTimestamp': message_timestamp, **item}
    item_with_keys = _convert_numbers(item_with_keys)
    return table.put_item(Item=item_with_keys)


def update_message(conversation_id: str, message_timestamp: str, updates: Dict[str, Any], profile_name: Optional[str] = None, region_name: Optional[str] = None):
    table = get_table('Messages', profile_name=profile_name, region_name=region_name)
    update_expr = 'SET ' + ', '.join(f"{k} = :{k}" for k in updates.keys())
    expr_values = {f":{k}": _convert_numbers(v) for k, v in updates.items()}
    return table.update_item(
        Key={'conversationId': conversation_id, 'messageTimestamp': message_timestamp},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
        ReturnValues='ALL_NEW',
    )


def query_messages_by_conversation(conversation_id: str, profile_name: Optional[str] = None, region_name: Optional[str] = None):
    table = get_table('Messages', profile_name=profile_name, region_name=region_name)
    response = table.query(KeyConditionExpression=Key('conversationId').eq(conversation_id))
    return response.get('Items', [])


def put_discount(product_id: str, start_at: int, item: Dict[str, Any], profile_name: Optional[str] = None, region_name: Optional[str] = None):
    table = get_table('Discounts', profile_name=profile_name, region_name=region_name)
    item_with_keys = {'productId': product_id, 'startAt': start_at, **item}
    item_with_keys = _convert_numbers(item_with_keys)
    return table.put_item(Item=item_with_keys)


def add_product_name(name: str, product_id: str, profile_name: Optional[str] = None, region_name: Optional[str] = None):
    table = get_table('ProductNames', profile_name=profile_name, region_name=region_name)
    return table.put_item(Item={'name': name, 'productId': product_id})


if __name__ == '__main__':
    import os

    profile = os.environ.get('AWS_PROFILE')
    region = os.environ.get('AWS_REGION', 'us-east-1')
    print('DynamoDB helper available. Set AWS_PROFILE and AWS_REGION to connect.')
