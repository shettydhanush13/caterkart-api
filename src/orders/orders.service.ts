import { Injectable } from '@nestjs/common';

@Injectable()
export class OrdersService {
  // Save order to database
  saveOrder(order: { orderData: any; userData: any; }) {
    console.log(order);
    return 'order saved';
  }
};
