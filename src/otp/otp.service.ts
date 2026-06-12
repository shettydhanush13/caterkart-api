import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import constants from '../config/constants';

@Injectable()
export class OTPService implements OnModuleInit {
  private readonly logger = new Logger(OTPService.name);
  private client: any;
  private servicesId: string;

  onModuleInit() {
    const { accountSid, authToken, servicesId } = constants.twillioConfig;
    if (!accountSid || !authToken || !servicesId) {
      this.logger.error(
        'Twilio credentials missing (TWILLIO_ACCOUNT_SID / TWILLIO_AUTH_TOKEN / TWILLIO_SERVICES_ID).',
      );
      throw new Error('Twilio credentials not configured');
    }
    this.servicesId = servicesId;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.client = require('twilio')(accountSid, authToken);
  }

  async sendOTP(to: string): Promise<string> {
    try {
      const verification = await this.client.verify.v2
        .services(this.servicesId)
        .verifications.create({ channel: 'sms', to });
      return verification.status;
    } catch (error: any) {
      this.logger.error(`sendOTP failed for ${to}`, error?.message || error);
      throw new InternalServerErrorException('Failed to send OTP');
    }
  }

  async verifyOTP(to: string, code: string): Promise<string> {
    try {
      const verificationCheck = await this.client.verify.v2
        .services(this.servicesId)
        .verificationChecks.create({ code, to });
      return verificationCheck.status;
    } catch (error: any) {
      this.logger.error(`verifyOTP failed for ${to}`, error?.message || error);
      throw new InternalServerErrorException('Failed to verify OTP');
    }
  }
}
