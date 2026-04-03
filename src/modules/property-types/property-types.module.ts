import { Module } from '@nestjs/common';
import { PropertyTypesController } from './property-types.controller';
import { PropertyTypesService } from './property-types.service';
import { PropertyTypesRepository } from './property-types.repository';

@Module({
  controllers: [PropertyTypesController],
  providers: [PropertyTypesRepository, PropertyTypesService],
  exports: [PropertyTypesRepository, PropertyTypesService],
})
export class PropertyTypesModule {}
