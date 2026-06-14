import { IsString, MinLength, IsArray } from "class-validator"

export class ShareReportDto {
  @IsString()
  runId!: string

  @IsString()
  @MinLength(1)
  title!: string

  @IsArray()
  content!: object[]
}
