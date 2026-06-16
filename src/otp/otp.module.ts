import { Module } from '@nestjs/common';
import { OTPController } from './otp.controller';
import { OTPService } from './otp.service';
import { AdminsModule } from '../admins/admins.module';

@Module({
  imports: [AdminsModule], // resolve the caller's role to embed in the JWT
  controllers: [OTPController],
  providers: [OTPService],
})
export class OTPModule {}
