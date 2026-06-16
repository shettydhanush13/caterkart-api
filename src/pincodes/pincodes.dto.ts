import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePincodeDto {
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Enter a valid 6-digit pincode' })
  pincode: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// Update may send any subset of the editable fields.
export class UpdatePincodeDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Enter a valid 6-digit pincode' })
  pincode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
