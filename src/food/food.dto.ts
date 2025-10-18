import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsNumber, IsArray } from 'class-validator';

export class UpdateFoodItemDto {
  @IsNotEmpty()
  @IsString()
  _id: string; // required for update

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  itemCode?: string;

  @IsOptional()
  @IsString()
  itemName?: string;

  @IsOptional()
  @IsBoolean()
  veg?: boolean;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsArray()
  cuisine?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  service?: Record<string, boolean>;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsNumber()
  minOrderQty?: number;

  @IsOptional()
  @IsNumber()
  serves?: number;
}
