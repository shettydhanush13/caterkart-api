import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// one supplier + the price they charge for the item
export class VendorPriceDto {
  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsNumber()
  price?: number;
}

export class UpdateFoodItemDto {
  @IsOptional()
  @IsString()
  _id?: string; // URL param is the source of truth; body _id is optional

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
  @IsString()
  vendor?: string; // per-vendor menu: the single owner of this item

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorPriceDto)
  vendors?: VendorPriceDto[]; // legacy (pre per-vendor migration)

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
