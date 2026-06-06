import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'

const DEFAULT_CHAT_QUEUE_URL = 'https://sqs.ap-southeast-1.amazonaws.com/851725487440/chat-queue'

let sqsClient

function getSqsClient() {
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION ?? 'ap-southeast-1'
    })
  }

  return sqsClient
}

export async function sendChatMessageToQueue({ conversation_id, message, product_id, buyer_username }) {
  const queueUrl = process.env.CHAT_QUEUE_URL ?? DEFAULT_CHAT_QUEUE_URL
  const body = {
    conversation_id,
    message,
    product_id,
    buyer_username
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
