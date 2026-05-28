import { Module } from "@nestjs/common"
import { ProjectAccessService } from "./project-access.service"
import { ArtifactsService } from "./artifacts.service"

@Module({
  providers: [ProjectAccessService, ArtifactsService],
  exports: [ProjectAccessService, ArtifactsService],
})
export class CommonModule {}
