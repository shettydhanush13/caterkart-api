// src/orders/orders.controller.ts
import { Body, Controller, Post, Get, Put, Param, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('order')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('')
  async createOrder(
    @Body() body: any,
  ) {
    try {
      const created = await this.ordersService.create(body);
      return created;
    } catch (error: any) {
      throw new HttpException(
        `Error storing order: ${error?.message ?? error}`,
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('')
  async getAllOrders() {
    try {
      return await this.ordersService.findAll();
    } catch (error: any) {
      throw new HttpException(
        `Error fetching orders: ${error?.message ?? error}`,
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getOrderById(@Param('id') id: string) {
    try {
      const order = await this.ordersService.findById(id);
      if (!order) {
        throw new NotFoundException(`Order with id ${id} not found`);
      }
      return order;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new HttpException(
        `Error fetching order: ${error?.message ?? error}`,
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  async replaceOrder(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    try {
      const updated = await this.ordersService.update(id, body);
      if (!updated) {
        throw new NotFoundException(`Order with id ${id} not found`);
      }
      return updated;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new HttpException(
        `Error updating order: ${error?.message ?? error}`,
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
