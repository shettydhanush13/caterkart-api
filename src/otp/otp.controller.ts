import { Body, Controller, Post, HttpException, HttpStatus } from '@nestjs/common';
import { OTPService } from './otp.service';

@Controller('verify')
export class OTPController {
  constructor(private readonly otpService: OTPService) {}

  // Update stock for a specific apparel code and size
  @Post('send-otp')
  sendOTP(
    @Body() body: { phone: number },
  ) {
    try {
      return this.otpService.sendOTP(body.phone);
    } catch (error) {
      throw new HttpException(
        `Error sending otp`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Update stock for multiple apparel codes and sizes
  @Post('verify-otp')
  verifyOTP(
    @Body() body: { phone: number; code: string },
  ) {
    try {
      return this.otpService.verifyOTP(body.phone, body.code);
    } catch (error) {
      throw new HttpException(
        `Error updating multiple stocks: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
