import { Module } from '@nestjs/common';
import { PincodesController } from './pincodes.controller';
import { PincodesService } from './pincodes.service';

@Module({
  imports: [],
  controllers: [PincodesController],
  providers: [PincodesService],
  exports: [PincodesService],
})
export class PincodesModule {}
