import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateVariableDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'name must start with a letter or underscore and contain only letters, numbers, and underscores',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  value?: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}
