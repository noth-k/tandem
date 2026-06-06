import json


def handler(event, context):
    print("Responder agent received:", json.dumps(event))

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "responder agent processed event"}),
    }
