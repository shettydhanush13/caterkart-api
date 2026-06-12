// src/orders/orders.controller.ts
import {
  Body,
  Controller,
  Post,
  Get,
  Put,
  Param,
  Query,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UpdateOrderDto, ListOrdersQueryDto } from './orders.dto';

@Controller('order')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post('')
  async createOrder(@Body() body: Record<string, any>) {
    // Typed as a plain object so the global ValidationPipe (whitelist +
    // forbidNonWhitelisted) skips it — the order is an intentionally flexible
    // blob persisted as-is. `date`/shape are enforced by the schema/service.
    try {
      return await this.ordersService.create(body);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('createOrder failed', error?.stack || error);
      throw new HttpException('Failed to store order', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('')
  async getAllOrders(@Query() query: ListOrdersQueryDto) {
    try {
      return await this.ordersService.findAll(query);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('getAllOrders failed', error?.stack || error);
      throw new HttpException('Failed to fetch orders', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('track/:phone')
  async trackByPhone(@Param('phone') phone: string) {
    try {
      return await this.ordersService.findByPhone(phone);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`trackByPhone failed`, error?.stack || error);
      throw new HttpException('Failed to fetch orders', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async getOrderById(@Param('id') id: string) {
    try {
      const order = await this.ordersService.findById(id);
      if (!order) throw new NotFoundException(`Order with id ${id} not found`);
      return order;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`getOrderById failed for ${id}`, error?.stack || error);
      throw new HttpException('Failed to fetch order', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  async replaceOrder(@Param('id') id: string, @Body() body: UpdateOrderDto) {
    // UpdateOrderDto whitelists the editable fields (status [enum-validated],
    // manager, remarks, vendors, payments, date, order). The admin client sends
    // a patch limited to these keys; OrdersService.update() also re-whitelists
    // before $set as defence in depth.
    try {
      const updated = await this.ordersService.update(id, body);
      if (!updated) throw new NotFoundException(`Order with id ${id} not found`);
      return updated;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`replaceOrder failed for ${id}`, error?.stack || error);
      throw new HttpException('Failed to update order', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
