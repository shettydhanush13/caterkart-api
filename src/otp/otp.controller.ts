import {
  Body,
  Controller,
  Post,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { OTPService } from './otp.service';
import { SendOtpDto, VerifyOtpDto } from './otp.dto';
import { AdminsService } from '../admins/admins.service';
import { Public } from '../auth/decorators';

@Controller('verify')
export class OTPController {
  private readonly logger = new Logger(OTPController.name);

  constructor(
    private readonly otpService: OTPService,
    private readonly admins: AdminsService,
    private readonly jwt: JwtService,
  ) {}

  // Tight limit on top of the global throttler: OTPs cost real money (Twilio),
  // so cap sends hard to stop SMS-bombing.
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('send-otp')
  async sendOTP(@Body() body: SendOtpDto) {
    try {
      const status = await this.otpService.sendOTP(body.phone);
      return { status };
    } catch (error: any) {
      this.logger.error('send-otp failed', error?.stack || error);
      throw new HttpException(
        'Failed to send OTP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-otp')
  async verifyOTP(@Body() body: VerifyOtpDto) {
    try {
      const status = await this.otpService.verifyOTP(body.phone, body.code);
      if (status !== 'approved') return { status };

      // OTP confirmed → mint a JWT carrying the caller's role/scope so the
      // client can authenticate subsequent requests. Customers get a token too
      // (isAdmin: false); staff get isAdmin/type/vendorName.
      const profile = await this.admins.profile(body.phone);
      const token = this.jwt.sign({
        phone: profile.phone || body.phone.replace(/\D/g, '').slice(-10),
        isAdmin: profile.isAdmin,
        type: profile.type,
        vendorName: profile.vendorName,
        name: profile.name,
      });
      return { status, token, profile };
    } catch (error: any) {
      this.logger.error('verify-otp failed', error?.stack || error);
      throw new HttpException(
        'Failed to verify OTP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
