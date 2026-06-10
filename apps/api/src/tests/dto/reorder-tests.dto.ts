import { IsArray, ValidateNested, IsString, IsInt } from 'class-validator'
import { Type } from 'class-transformer'

class TestOrderItem {
  @IsString()
  id!: string

  @IsInt()
  order!: number
}

export class ReorderTestsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestOrderItem)
  tests!: Array<{ id: string; order: number }>
}
