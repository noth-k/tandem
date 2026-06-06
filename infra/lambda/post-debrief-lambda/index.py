import json


def handler(event, context):
    print("Post debrief request:", json.dumps(event))

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"message": "post stream debrief generated"}),
    }
