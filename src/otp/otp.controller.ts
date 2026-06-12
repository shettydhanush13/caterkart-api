import {
  Body,
  Controller,
  Post,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { OTPService } from './otp.service';
import { SendOtpDto, VerifyOtpDto } from './otp.dto';

@Controller('verify')
export class OTPController {
  private readonly logger = new Logger(OTPController.name);

  constructor(private readonly otpService: OTPService) {}

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

  @Post('verify-otp')
  async verifyOTP(@Body() body: VerifyOtpDto) {
    try {
      const status = await this.otpService.verifyOTP(body.phone, body.code);
      return { status };
    } catch (error: any) {
      this.logger.error('verify-otp failed', error?.stack || error);
      throw new HttpException(
        'Failed to verify OTP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
