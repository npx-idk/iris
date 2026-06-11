import { IsInt, Min, Max } from "class-validator"

export class SetViewportDto {
  @IsInt()
  @Min(240)
  @Max(3840)
  width!: number

  @IsInt()
  @Min(240)
  @Max(2160)
  height!: number
}
