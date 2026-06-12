import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  date: string;

  @IsOptional()
  @IsArray()
  services?: any[];

  // Allow additional arbitrary shape inside `order` body; actual validation
  // should be tightened to match real business fields once schema is locked.
  [key: string]: any;
}

export const ALLOWED_ORDER_STATUSES = [
  'new',
  'confirmed',
  'contacted',
  'in_progress',
  'delivered',
  'completed',
  'cancelled',
  'payment done',
] as const;

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_ORDER_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsString()
  manager?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsObject()
  vendors?: Record<string, any>;

  @IsOptional()
  @IsObject()
  payments?: Record<string, any>;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  order?: any;
}

export class ListOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_ORDER_STATUSES as unknown as string[])
  status?: string;
}
