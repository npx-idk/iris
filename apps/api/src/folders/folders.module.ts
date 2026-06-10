import { Module } from "@nestjs/common"
import { FoldersController } from "./folders.controller"
import { FoldersService } from "./folders.service"
import { CommonModule } from "../common/common.module"

@Module({
  imports: [CommonModule],
  controllers: [FoldersController],
  providers: [FoldersService],
})
export class FoldersModule {}
