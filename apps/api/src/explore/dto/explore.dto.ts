import { IsString, IsUrl, IsOptional, MaxLength } from 'class-validator'

export class ExploreDto {
  @IsString()
  @IsUrl({ require_tld: false })
  url!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  context?: string

  @IsOptional()
  @IsString()
  prerequisiteTestId?: string
}
