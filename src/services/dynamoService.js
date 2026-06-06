import { DynamoDBClient, PutItemCommand, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'

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
      reply_sent: Boolean(item.replySent?.BOOL),
      ai_response: item.aiResponse?.S ?? item.ai_response?.S ?? '',
      flagged_important: Boolean(item.flaggedImportant?.BOOL ?? item.flagged_important?.BOOL),
      sender_type: item.senderType?.S ?? item.sender_type?.S ?? 'buyer',
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

export async function listPendingReplyMessages({ livestream_id, limit = 25 }) {
  const tableName = process.env.CHAT_MESSAGES_TABLE ?? DEFAULT_MESSAGES_TABLE
  const maxItems = Math.max(1, Math.min(Number(limit) || 25, 100))
  const client = getDynamoClient()
  const items = []
  let ExclusiveStartKey

  do {
    const response = await client.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey
    }))

    for (const item of response.Items ?? []) {
      if (items.length >= maxItems) break

      const normalized = normalizeMessageItem(item)
      if (livestream_id && normalized.livestream_id !== livestream_id) continue
      if (normalized.sender_type === 'ai') continue
      if (!normalized.reply_needed || normalized.reply_sent) continue

      items.push(normalized)
    }

    ExclusiveStartKey = response.LastEvaluatedKey
  } while (ExclusiveStartKey && items.length < maxItems)

  return {
    tableName,
    messages: items.sort((a, b) => a.conversation_timestamp.localeCompare(b.conversation_timestamp))
  }
}

export async function saveAiResponseMessage({
  originalMessage,
  responseText,
  important
}) {
  const tableName = process.env.CHAT_MESSAGES_TABLE ?? DEFAULT_MESSAGES_TABLE
  const timestamp = new Date().toISOString()
  const responseId = `agent3_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`

  const command = new PutItemCommand({
    TableName: tableName,
    Item: {
      conversationId: { S: responseId },
      conversation_id: { S: responseId },
      messageTimestamp: { S: timestamp },
      conversation_timestamp: { S: timestamp },
      messageId: { S: responseId },
      livestreamId: { S: originalMessage.livestream_id },
      livestream_id: { S: originalMessage.livestream_id },
      buyerUsername: { S: 'Tandem' },
      buyer_username: { S: 'Tandem' },
      messageText: { S: responseText },
      message: { S: responseText },
      productId: { S: originalMessage.product_id },
      product_id: { S: originalMessage.product_id },
      aiCategory: { S: 'ai_response' },
      priority: { N: '0' },
      replyNeeded: { BOOL: false },
      replySent: { BOOL: true },
      queuedToResponder: { BOOL: false },
      classifierSource: { S: 'agent3' },
      senderType: { S: 'ai' },
      sender_type: { S: 'ai' },
      agentName: { S: 'agent3' },
      inReplyToConversationId: { S: originalMessage.conversation_id },
      inReplyToBuyerUsername: { S: originalMessage.buyer_username },
      flaggedImportant: { BOOL: Boolean(important) },
      flagged_important: { BOOL: Boolean(important) },
      createdAt: { S: timestamp }
    }
  })

  const response = await getDynamoClient().send(command)

  return {
    tableName,
    responseId,
    timestamp,
    statusCode: response.$metadata?.httpStatusCode
  }
}

export async function markMessageReplySent({
  conversation_id,
  conversation_timestamp,
  aiResponse,
  important
}) {
  const tableName = process.env.CHAT_MESSAGES_TABLE ?? DEFAULT_MESSAGES_TABLE
  const now = new Date().toISOString()

  const response = await getDynamoClient().send(new UpdateItemCommand({
    TableName: tableName,
    Key: {
      conversationId: { S: conversation_id },
      messageTimestamp: { S: conversation_timestamp }
    },
    UpdateExpression: [
      'SET replySent = :replySent',
      'aiResponse = :aiResponse',
      'ai_response = :aiResponse',
      'flaggedImportant = :important',
      'flagged_important = :important',
      'updatedAt = :updatedAt'
    ].join(', '),
    ExpressionAttributeValues: {
      ':replySent': { BOOL: true },
      ':aiResponse': { S: aiResponse },
      ':important': { BOOL: Boolean(important) },
      ':updatedAt': { S: now }
    },
    ReturnValues: 'ALL_NEW'
  }))

  return {
    tableName,
    statusCode: response.$metadata?.httpStatusCode
  }
}

function normalizeMessageItem(item) {
  return {
    conversation_id: item.conversationId?.S ?? item.conversation_id?.S ?? '',
    conversation_timestamp: item.messageTimestamp?.S ?? item.conversation_timestamp?.S ?? '',
    message_id: item.messageId?.S ?? '',
    livestream_id: item.livestreamId?.S ?? item.livestream_id?.S ?? '',
    buyer_username: item.buyerUsername?.S ?? item.buyer_username?.S ?? '',
    message: item.messageText?.S ?? item.message?.S ?? '',
    product_id: item.productId?.S ?? item.product_id?.S ?? '',
    category: item.aiCategory?.S ?? 'other',
    priority: Number(item.priority?.N ?? 0),
    reply_needed: Boolean(item.replyNeeded?.BOOL ?? item.reply_needed?.BOOL),
    reply_sent: Boolean(item.replySent?.BOOL ?? item.reply_sent?.BOOL),
    flagged_important: Boolean(item.flaggedImportant?.BOOL ?? item.flagged_important?.BOOL),
    sender_type: item.senderType?.S ?? item.sender_type?.S ?? 'buyer',
    created_at: item.createdAt?.S ?? ''
  }
}
