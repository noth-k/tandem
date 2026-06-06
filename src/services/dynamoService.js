import { DynamoDBClient, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb'

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
  const messageId = payload.conversation_id

  const command = new PutItemCommand({
    TableName: tableName,
    Item: {
      conversationId: { S: payload.conversation_id },
      conversation_id: { S: payload.conversation_id },
      messageTimestamp: { S: payload.conversation_timestamp },
      conversation_timestamp: { S: payload.conversation_timestamp },
      messageId: { S: messageId },
      livestreamId: { S: payload.livestream_id },
      livestream_id: { S: payload.livestream_id },
      buyerUsername: { S: payload.buyer_username },
      buyer_username: { S: payload.buyer_username },
      messageText: { S: payload.message },
      message: { S: payload.message },
      productId: { S: payload.product_id },
      product_id: { S: payload.product_id },
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

export async function listChatMessages({ livestream_id, limit = 100 }) {
  const tableName = process.env.CHAT_MESSAGES_TABLE ?? DEFAULT_MESSAGES_TABLE
  const maxItems = Math.max(1, Math.min(Number(limit) || 100, 250))
  const client = getDynamoClient()

  const items = []
  let ExclusiveStartKey

  do {
    const command = livestream_id
      ? new ScanCommand({
          TableName: tableName,
          FilterExpression: 'livestreamId = :livestreamId OR livestream_id = :livestreamId',
          ExpressionAttributeValues: {
            ':livestreamId': { S: livestream_id }
          },
          ExclusiveStartKey
        })
      : new ScanCommand({
          TableName: tableName,
          ExclusiveStartKey
        })

    const response = await client.send(command)
    items.push(...(response.Items ?? []))
    ExclusiveStartKey = response.LastEvaluatedKey
  } while (ExclusiveStartKey && items.length < maxItems)

  const messages = items
    .map((item) => ({
      conversation_id: item.conversationId?.S ?? item.conversation_id?.S ?? '',
      conversation_timestamp: item.messageTimestamp?.S ?? item.conversation_timestamp?.S ?? '',
      message_id: item.messageId?.S ?? '',
      livestream_id: item.livestreamId?.S ?? item.livestream_id?.S ?? '',
      buyer_username: item.buyerUsername?.S ?? item.buyer_username?.S ?? '',
      message: item.messageText?.S ?? item.message?.S ?? '',
      product_id: item.productId?.S ?? item.product_id?.S ?? '',
      category: item.aiCategory?.S ?? 'other',
      priority: Number(item.priority?.N ?? 0),
      reply_needed: Boolean(item.replyNeeded?.BOOL),
      queued_to_responder: Boolean(item.queuedToResponder?.BOOL),
      classifier_source: item.classifierSource?.S ?? '',
      created_at: item.createdAt?.S ?? ''
    }))
    .sort((a, b) => a.conversation_timestamp.localeCompare(b.conversation_timestamp))
    .slice(-maxItems)

  return {
    tableName,
    messages
  }
}
