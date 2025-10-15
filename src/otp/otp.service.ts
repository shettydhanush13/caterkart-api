import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import constants from '../config/constants';

const { accountSid, authToken, servicesId } = constants.twillioConfig
const client = require('twilio')(accountSid, authToken);

@Injectable()
export class OTPService {
  async sendOTP(to: number) {
    try {
      const verification = await client.verify.v2
        .services(servicesId)
        .verifications.create({
          channel: "sms",
          to,
        });
        return verification.status;
      } catch (error) {
      throw new HttpException('Failed to send OTP', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async verifyOTP(to: number, code: string) {
    try {
      const verificationCheck = await client.verify.v2
        .services(servicesId)
        .verificationChecks.create({
          code,
          to,
        });
        return verificationCheck.status;
    } catch (error) {
      throw new HttpException('Failed to verify OTP', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
