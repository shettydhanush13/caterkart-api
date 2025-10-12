// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersSchema, OrdersModelName } from './orders.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: OrdersModelName, schema: OrdersSchema }]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
