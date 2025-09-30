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
