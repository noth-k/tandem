export const config = {
  aws: {
    region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'ap-southeast-1',
    tables: {
      products: process.env.PRODUCTS_TABLE ?? process.env.PRODUCT_DETAILS_TABLE ?? 'Products',
      messages: process.env.MESSAGES_TABLE ?? process.env.CHAT_MESSAGES_TABLE ?? 'Messages',
      discounts: process.env.DISCOUNTS_TABLE ?? 'Discounts'
    },
    queues: {
      chat: process.env.CHAT_QUEUE_URL ?? '',
      productDetails: process.env.PRODUCT_DETAILS_QUEUE_URL ?? ''
    },
    lambdas: {
      postDebriefUrl: process.env.POST_DEBRIEF_LAMBDA_URL ?? ''
    }
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    classifierModel: process.env.OPENAI_CLASSIFIER_MODEL ?? 'gpt-4o-mini',
    debriefModel: process.env.OPENAI_DEBRIEF_MODEL ?? 'gpt-5.4-mini'
  }
}
