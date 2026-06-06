import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'

const DEFAULT_CHAT_QUEUE_URL = 'https://sqs.ap-southeast-1.amazonaws.com/851725487440/chat-queue'
const DEFAULT_PRODUCT_DETAILS_QUEUE_URL = 'https://sqs.ap-southeast-1.amazonaws.com/851725487440/product-details-queue'

let sqsClient

function getSqsClient() {
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION ?? 'ap-southeast-1'
    })
  }

  return sqsClient
}

export async function sendChatMessageToQueue({
  conversation_id,
  conversation_timestamp,
  message,
  product_id,
  buyer_username,
  livestream_id
}) {
  const queueUrl = process.env.CHAT_QUEUE_URL ?? DEFAULT_CHAT_QUEUE_URL
  const body = {
    conversation_id,
    conversation_timestamp,
    message,
    product_id,
    buyer_username,
    livestream_id
  }

  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(body)
  })

  const response = await getSqsClient().send(command)

  return {
    messageId: response.MessageId,
    queueUrl
  }
}

export async function sendProductDetailsMessageToQueue(message) {
  const queueUrl = process.env.PRODUCT_DETAILS_QUEUE
    ?? process.env.PRODUCT_DETAILS_QUEUE_URL
    ?? DEFAULT_PRODUCT_DETAILS_QUEUE_URL

  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message)
  })

  const response = await getSqsClient().send(command)

  return {
    messageId: response.MessageId,
    queueUrl
  }
}
