import { Module } from '@nestjs/common';
import { StolenPropertyController } from './stolen-property.controller';
import { StolenPropertyService } from './stolen-property.service';
import { StolenPropertyRepository } from './stolen-property.repository';

@Module({
  controllers: [StolenPropertyController],
  providers: [StolenPropertyRepository, StolenPropertyService],
  exports: [StolenPropertyRepository, StolenPropertyService],
})
export class StolenPropertyModule {}
