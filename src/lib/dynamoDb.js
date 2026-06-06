import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'

import { config } from './config.js'

const tableNames = config.aws.tables

let documentClient

export function getDocumentClient() {
  if (!documentClient) {
    const client = new DynamoDBClient({
      region: config.aws.region
    })
    documentClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true
      }
    })
  }

  return documentClient
}

export async function loadDebriefData({ conversationId }) {
  const client = getDocumentClient()
  const [products, messages, discounts] = await Promise.all([
    scanAll(client, tableNames.products),
    queryMessages(client, tableNames.messages, conversationId),
    scanAll(client, tableNames.discounts)
  ])

  return { products, messages, discounts }
}

async function queryMessages(client, tableName, conversationId) {
  if (!conversationId) return scanAll(client, tableName)

  const items = []
  let ExclusiveStartKey

  do {
    const response = await client.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'conversationId = :conversationId',
      ExpressionAttributeValues: {
        ':conversationId': conversationId
      },
      ExclusiveStartKey
    }))

    items.push(...(response.Items ?? []))
    ExclusiveStartKey = response.LastEvaluatedKey
  } while (ExclusiveStartKey)

  return items
}

async function scanAll(client, tableName) {
  const items = []
  let ExclusiveStartKey

  do {
    const response = await client.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey
    }))

    items.push(...(response.Items ?? []))
    ExclusiveStartKey = response.LastEvaluatedKey
  } while (ExclusiveStartKey)

  return items
}
