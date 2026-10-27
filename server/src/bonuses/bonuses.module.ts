import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BonusesController } from "./bonuses.controller";

@Module({ imports: [AuthModule], controllers: [BonusesController] })
export class BonusesModule {}
