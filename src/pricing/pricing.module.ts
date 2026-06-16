import { Global, Module } from '@nestjs/common';
import { PricingService } from './pricing.service';

// Global so any module (orders, payments) can recompute authoritative pricing.
@Global()
@Module({
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
