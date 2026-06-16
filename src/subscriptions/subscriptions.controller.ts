import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import {
  CreateSubscriptionDto,
  ListSubscriptionsQueryDto,
  UpdateSubscriptionDto,
} from './subscriptions.dto';
import { Public, Staff } from '../auth/decorators';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  // Customer enquiry from the public site (gated by OTP on the client).
  @Public()
  @Post()
  create(@Body() body: CreateSubscriptionDto) {
    return this.subscriptions.create(body);
  }

  @Staff()
  @Get()
  list(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptions.list(query);
  }

  @Staff()
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.subscriptions.findById(id);
  }

  @Staff()
  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateSubscriptionDto) {
    return this.subscriptions.update(id, body);
  }

  // Allocate (once) the sequential weekly tax-invoice number for a given week.
  @Staff()
  @Post(':id/invoice')
  assignWeeklyInvoice(@Param('id') id: string, @Body() body: { week?: string }) {
    return this.subscriptions.assignWeeklyInvoice(id, body?.week || 'W1');
  }
}
