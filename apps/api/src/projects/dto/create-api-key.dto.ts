import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { API_KEY_ROLES, type ApiKeyRole } from '@iris/common';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsIn(API_KEY_ROLES)
  role!: ApiKeyRole;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
