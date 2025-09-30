import { Body, Controller, Post, HttpException, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('order')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('order')
  checkOrderFulfillment(
    @Body() body: { orderData: any; userData: any },
  ) {
    try {
      console.log(body);
      return this.ordersService.saveOrder(body);
    } catch (error) {
      throw new HttpException(
        `Error fulfilling order: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
