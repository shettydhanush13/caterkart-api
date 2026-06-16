import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateDirectLinkDto, CreatePaymentDto, VerifyPaymentDto } from './payments.dto';
import { Public, Staff } from '../auth/decorators';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // Create a Razorpay order for a CaterKart order (kind = advance | balance | full).
  // Public: the customer pays from the track-order page (amount is server-authoritative).
  @Public()
  @Post('order/:id')
  @HttpCode(HttpStatus.OK)
  createOrderPayment(@Param('id') id: string, @Body() body: CreatePaymentDto) {
    return this.payments.createOrderPayment(id, body?.kind || 'advance');
  }

  // Create a hosted Razorpay payment link & notify the customer (SMS/email) — staff action
  @Staff()
  @Post('order/:id/link')
  @HttpCode(HttpStatus.OK)
  createPaymentLink(@Param('id') id: string, @Body() body: CreatePaymentDto) {
    return this.payments.createPaymentLink(id, body?.kind || 'balance');
  }

  // Create a hosted Razorpay payment link for an explicit amount (subscriptions) — staff action
  @Staff()
  @Post('link')
  @HttpCode(HttpStatus.OK)
  createDirectLink(@Body() body: CreateDirectLinkDto) {
    return this.payments.createDirectLink(body);
  }

  // Reconcile an order's payment status from Razorpay (no webhook needed) — staff action
  @Staff()
  @Post('order/:id/sync')
  @HttpCode(HttpStatus.OK)
  sync(@Param('id') id: string) {
    return this.payments.syncOrderPayment(id);
  }

  // Verify the Checkout signature and mark the order paid (customer completes checkout)
  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() body: VerifyPaymentDto) {
    return this.payments.verifyPayment(body);
  }

  // Razorpay server-to-server webhook (raw body + HMAC — its own auth)
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: Request) {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = (req as any).rawBody as Buffer;
    await this.payments.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
