import { IsInt, IsOptional, IsBoolean, Min } from 'class-validator'

export class SeekDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  fromFlatPos?: number  // flat index across [prereq steps..., main steps]; default 0

  @IsOptional()
  @IsInt()
  @Min(0)
  toFlatPos?: number  // inclusive; default = last step

  @IsOptional()
  @IsBoolean()
  navigate?: boolean  // navigate to startUrl before first step; default true
}
