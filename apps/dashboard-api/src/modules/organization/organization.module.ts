import { Module } from "@nestjs/common";
import { OrganizationController } from "./organization.controller";
import { OrganizationService } from "./organization.service";
import { OrganizationRepository } from "./organization.repository";
import { ConfigModule } from "../../core/config/config.module";
import { SharedDatabaseModule } from "@app/shared/database";

@Module({
    imports: [
        ConfigModule,
        SharedDatabaseModule
    ],
    controllers: [OrganizationController],
    providers: [OrganizationService, OrganizationRepository],
    exports: [],
})
export class OrganizationModule {}