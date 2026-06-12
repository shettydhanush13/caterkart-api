import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'phone must be a valid E.164 number (e.g. +919999999999)',
  })
  phone: string;
}

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'phone must be a valid E.164 number (e.g. +919999999999)',
  })
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'code must be 4-8 digits' })
  code: string;
}
