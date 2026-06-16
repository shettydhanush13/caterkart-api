import { IsIn, IsInt, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  @IsIn(['advance', 'balance', 'full'])
  kind?: string;
}

export class CreateDirectLinkDto {
  @IsInt()
  @Min(1)
  amount: number; // rupees

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  notes?: Record<string, any>;
}

export class VerifyPaymentDto {
  @IsString()
  @MinLength(1)
  razorpay_order_id: string;

  @IsString()
  @MinLength(1)
  razorpay_payment_id: string;

  @IsString()
  @MinLength(1)
  razorpay_signature: string;
}
