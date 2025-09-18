import { ConfigModule } from "@/core/config/config.module";
import { DatabaseModule } from "@/core/database/database.module";
import { Module } from "@nestjs/common";
import { OrganizationController } from "./organization.controller";
import { OrganizationService } from "./organization.service";
import { OrganizationRepository } from "./organization.repository";

@Module({
    imports: [
        ConfigModule,
        DatabaseModule
    ],
    controllers: [OrganizationController],
    providers: [OrganizationService, OrganizationRepository],
    exports: [],
})
export class OrganizationModule {}