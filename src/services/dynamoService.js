import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'

const DEFAULT_MESSAGES_TABLE = 'Messages'

let dynamoClient

function getDynamoClient() {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION ?? 'ap-southeast-1'
    })
  }

  return dynamoClient
}

export async function saveChatMessage({
  payload,
  classification,
  queued
}) {
  const tableName = process.env.CHAT_MESSAGES_TABLE ?? DEFAULT_MESSAGES_TABLE
  const messageId = [
    payload.conversation_id,
    payload.conversation_timestamp,
    payload.buyer_username
  ].join('#')

  const command = new PutItemCommand({
    TableName: tableName,
    Item: {
      conversationId: { S: payload.conversation_id },
      messageTimestamp: { S: payload.conversation_timestamp },
      messageId: { S: messageId },
      buyerUsername: { S: payload.buyer_username },
      messageText: { S: payload.message },
      productId: { S: payload.product_id },
      aiCategory: { S: classification.category },
      priority: { N: String(classification.priority) },
      replyNeeded: { BOOL: classification.reply_needed },
      escalated: { BOOL: classification.reply_needed },
      replySent: { BOOL: false },
      queuedToResponder: { BOOL: queued },
      classifierSource: { S: classification.source },
      createdAt: { S: new Date().toISOString() }
    }
  })

  const response = await getDynamoClient().send(command)

  return {
    tableName,
    messageId,
    statusCode: response.$metadata?.httpStatusCode
  }
}
