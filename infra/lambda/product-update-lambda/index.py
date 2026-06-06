import json


def handler(event, context):
    print("Product update received:", json.dumps(event))

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "product update processed event"}),
    }
