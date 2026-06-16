import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Enter a valid phone number' })
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['admin', 'vendor'])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendorName?: string;
}
