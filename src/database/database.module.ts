import { Global, Module } from '@nestjs/common';
import { DbInitService } from './db-init.service';

// Owns cross-cutting database concerns. Currently ensures all collection
// indexes exist at application boot (idempotent).
@Global()
@Module({
  providers: [DbInitService],
  exports: [DbInitService],
})
export class DatabaseModule {}
