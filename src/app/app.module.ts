import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OTPModule } from '../services/otp.module';
import { OrdersModule } from '../orders/orders.moudle';

@Module({
  imports: [OTPModule, OrdersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
