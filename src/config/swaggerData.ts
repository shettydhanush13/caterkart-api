export const updateStockReqBody = {
    description: 'Body to update stock details',
    required: true,
    schema: {
      example: {
        apparelCode: '1',
        size: 'S',
        price: 10,
        quantity: 2
      },
    },
}

export const updateMultipleStockReqBody = {
    description: 'Body to update stock details',
    required: true,
    schema: {
      example: [{
        apparelCode: '1',
        size: 'S',
        price: 10,
        quantity: 2
      }],
    },
}

export const getStockByApparelCodeParam = {
    name: 'apparelCode',
    description: 'Unique identifier for the apparel',
    required: true,
    type: String,
}

export const sendOTPBody = {
  description: 'send otp',
  required: true,
  schema: {
    example: {
      phone: '+918971780778',
    },
  },
}

export const verifyOTPBody = {
  description: 'verify otp',
  required: true,
  schema: {
    example: {
      phone: '+918971780778',
      code: '1234'
    },
  },
}

export const checkOrderFulfillmentReqBody = {
    description: 'Body to check order fulfillment details',
    required: true,
    schema: {
      example: [{
        apparelCode: '1',
        size: 'S',
        quantity: 2
      }],
    },
}

export const checkOrderFulfillmentApparelNotFound = {
    status: 404,
    description: 'Apparel with code not found',
}

export const checkOrderFulfillmentSizeNotFound = {
    status: 404,
    description: 'Size for apparel code not available',
}

export const updateStockResponse = {
    status: 201,
    description: 'Stock data updated successfully for apparel code and size',
}

export const updateStockNoRequest = {
    status: 400,
    description: 'At least one of price or quantity must be provided',
}

export const updateMultipleStockEmptyRequest = {
    status: 400,
    description: 'Updates array cannot be empty',
}

export const updateMultipleStockResponse = {
    status: 201,
    description: 'Multiple stocks updated successfully',
}

export const checkOrderFulfillmentResponse = {
    status: 200,
    description: 'Order fulfillment details',
    schema: {
      example: {
        canFulfillFully: true,
        outOfStockItems: [],
        inStockItems: [],
        fulfillmentCost: 0,
      }
    },
}

export const getStockReadError = {
    status: 500,
    description: 'Failed to read stock data',
}

export const getStocksResponse = {
    status: 200,
    description: 'stock details',
    schema: {
      example: [{
        apparelCode: '1',
        size: 'S',
        price: 10,
        quantity: 2
      }]
    },
}

export const getStockResponse = {
    status: 200,
    description: 'stock details for particular apparel',
    schema: {
      example: {
        apparelCode: '1',
        size: 'S',
        price: 10,
        quantity: 2
      }
    },
}