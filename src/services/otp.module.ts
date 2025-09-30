import { Module } from '@nestjs/common';
import { OTPController } from './otp.controller';
import { OTPService } from './otp.service';

@Module({
  imports: [],
  controllers: [OTPController],
  providers: [OTPService],
})
export class OTPModule {}
