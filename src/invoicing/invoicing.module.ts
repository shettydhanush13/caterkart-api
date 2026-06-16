// src/invoicing/invoicing.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InvoicingService } from './invoicing.service';
import { InvoiceCounterSchema, InvoiceCounterModelName } from './invoice-counter.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InvoiceCounterModelName, schema: InvoiceCounterSchema },
    ]),
  ],
  providers: [InvoicingService],
  exports: [InvoicingService],
})
export class InvoicingModule {}
