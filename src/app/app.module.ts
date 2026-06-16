import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OTPModule } from '../otp/otp.module';
import { OrdersModule } from '../orders/orders.moudle';
import { FoodModule } from 'src/food/food.module';
import { ServicesModule } from '../services/services.module';
import { CombosModule } from '../combos/combos.module';
import { VendorsModule } from '../vendors/vendors.module';
import { AdminsModule } from '../admins/admins.module';
import { PincodesModule } from '../pincodes/pincodes.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PaymentsModule } from '../payments/payments.module';
import { DatabaseModule } from '../database/database.module';
import { PricingModule } from '../pricing/pricing.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    OTPModule,
    OrdersModule,
    FoodModule,
    ServicesModule,
    CombosModule,
    VendorsModule,
    AdminsModule,
    PincodesModule,
    ReviewsModule,
    SubscriptionsModule,
    PaymentsModule,
    DatabaseModule,
    PricingModule,

    // Load environment variables from .env
    ConfigModule.forRoot({
      isGlobal: true, // makes ConfigService available everywhere
    }),

    AuthModule,

    // Global rate limiting. A generous default protects every endpoint from
    // abuse; OTP routes layer a much tighter per-route limit on top (see the
    // OTP controller) to stop SMS-bombing / Twilio cost abuse.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),

    // Mongoose connection using env vars.
    // Pool + timeout + retry + compression are tuned for a cost-efficient,
    // resilient connection (small bounded pool, fail-fast on a stalled primary,
    // retryable writes/reads, wire compression). All overridable via env.
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const num = (key: string, fallback: number) =>
          Number(configService.get<string>(key)) || fallback;
        return {
          uri: configService.get<string>('MONGO_URI'),
          dbName: configService.get<string>('MONGO_DB_NAME'),
          // bounded pool — keeps Atlas connection cost predictable
          maxPoolSize: num('MONGO_MAX_POOL', 10),
          minPoolSize: num('MONGO_MIN_POOL', 0),
          maxIdleTimeMS: num('MONGO_MAX_IDLE_MS', 60_000),
          // fail fast instead of hanging requests when the primary is unreachable
          serverSelectionTimeoutMS: num('MONGO_SERVER_SELECTION_MS', 8_000),
          socketTimeoutMS: num('MONGO_SOCKET_TIMEOUT_MS', 45_000),
          connectTimeoutMS: num('MONGO_CONNECT_TIMEOUT_MS', 10_000),
          heartbeatFrequencyMS: num('MONGO_HEARTBEAT_MS', 30_000),
          // safe, retryable writes + smaller payloads over the wire
          retryWrites: true,
          retryReads: true,
          compressors: ['zlib'],
          zlibCompressionLevel: 6,
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: rate-limit first, then authenticate, then authorize roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
