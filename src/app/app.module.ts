import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OTPModule } from '../otp/otp.module';
import { OrdersModule } from '../orders/orders.moudle';
import { FoodModule } from 'src/food/food.module';
import { ServicesModule } from './services/services.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    OTPModule,
    OrdersModule,
    FoodModule,
    ServicesModule,

    // Load environment variables from .env
    ConfigModule.forRoot({
      isGlobal: true, // makes ConfigService available everywhere
    }),

    // Mongoose connection using env vars
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        dbName: configService.get<string>('MONGO_DB_NAME'),
    }),
  })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
