import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb'

import { demoProducts } from './demoData.js'

const productsTable = process.env.PRODUCTS_TABLE ?? 'Products'
const discountsTable = process.env.DISCOUNTS_TABLE ?? 'Discounts'

let docClient

function getClient() {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(new DynamoDBClient({
      region: process.env.AWS_REGION ?? 'us-east-1'
    }), {
      marshallOptions: {
        removeUndefinedValues: true
      }
    })
  }

  return docClient
}

export async function listProducts() {
  if (process.env.USE_MOCK_PRODUCTS === 'true' || !isDynamoEnabled()) {
    return normalizeProducts(demoProducts)
  }

  try {
    const response = await getClient().send(new ScanCommand({ TableName: productsTable }))
    const products = normalizeProducts(response.Items ?? [])
    return products
  } catch (error) {
    const err = new Error(`Could not load products from DynamoDB: ${error.message}`)
    err.statusCode = 502
    err.code = 'dynamodb_products_error'
    throw err
  }
}

export async function findProductById(productId) {
  const products = await listProducts()
  return products.find((product) => product.id === productId || product.productId === productId) ?? null
}

export async function getCurrentProduct() {
  if (process.env.USE_MOCK_PRODUCTS === 'true' || !isDynamoEnabled()) {
    return null
  }

  try {
    const response = await getClient().send(new ScanCommand({
      TableName: productsTable,
      FilterExpression: 'isCurrent = :true',
      ExpressionAttributeValues: {
        ':true': true
      },
      Limit: 1
    }))

    return normalizeProducts(response.Items ?? [])[0] ?? null
  } catch (error) {
    console.warn(`Could not read current product from DynamoDB: ${error.message}`)
    return null
  }
}

export async function setCurrentProduct(productId) {
  if (process.env.USE_MOCK_PRODUCTS === 'true' || !isDynamoEnabled()) {
    return { saved: false, reason: 'dynamodb_not_configured' }
  }

  const products = await listProducts()
  if (!products.some((product) => product.productId === productId)) {
    const err = new Error(`Product '${productId}' does not exist`)
    err.statusCode = 404
    err.code = 'product_not_found'
    throw err
  }

  const updatedAt = new Date().toISOString()
  const transactItems = products.map((product) => ({
    Update: {
      TableName: productsTable,
      Key: { productId: product.productId },
      UpdateExpression: 'SET isCurrent = :isCurrent, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isCurrent': product.productId === productId,
        ':updatedAt': updatedAt
      }
    }
  }))

  try {
    await getClient().send(new TransactWriteCommand({ TransactItems: transactItems }))
    return { saved: true, updatedAt }
  } catch (error) {
    console.warn(`Could not set current product in DynamoDB: ${error.message}`)
    return { saved: false, reason: error.message }
  }
}

export async function saveDiscount(discount) {
  if (process.env.USE_MOCK_PRODUCTS === 'true' || !isDynamoEnabled()) {
    return { saved: false, reason: 'dynamodb_not_configured' }
  }

  const startAt = discount.startAt ?? Date.now()
  const durationMs = discount.durationSeconds ? discount.durationSeconds * 1000 : 0
  try {
    await getClient().send(new PutCommand({
      TableName: discountsTable,
      Item: {
        productId: discount.productId,
        startAt,
        discountId: discount.id,
        valueAmount: discount.discountType === 'fixed' ? discount.discountAmount : 0,
        valuePercent: discount.discountType === 'percent' ? discount.discountAmount : 0,
        endAt: durationMs > 0 ? startAt + durationMs : undefined,
        acceptedBySeller: true,
        appliedBy: 'audio-parser',
        sourcePlatform: discount.sourcePlatform ?? 'browser-demo',
        sellerTranscript: discount.sellerTranscript,
        parseConfidence: discount.parseConfidence,
        createdAt: new Date().toISOString()
      }
    }))
    return { saved: true }
  } catch (error) {
    console.warn(`Discount was applied in memory but not saved to DynamoDB: ${error.message}`)
    return { saved: false, reason: error.message }
  }
}

export function normalizeProducts(products) {
  return products.map((product) => ({
    ...product,
    id: product.id ?? product.productId,
    productId: product.productId ?? product.id,
    stockQty: product.stockQty ?? product.stock,
    price: product.price,
    currency: product.currency ?? 'USD'
  }))
}

export function isDynamoEnabled() {
  return process.env.USE_DYNAMODB === 'true'
    || Boolean(process.env.AWS_PROFILE)
    || Boolean(process.env.AWS_ACCESS_KEY_ID)
    || Boolean(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI)
    || Boolean(process.env.AWS_WEB_IDENTITY_TOKEN_FILE)
}
