import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyTypesService } from './property-types.service';
import { CreatePropertyTypeDto } from './dto/create-property-type.dto';
import { UpdatePropertyTypeDto } from './dto/update-property-type.dto';
import { PropertyTypeFilterDto } from './dto/property-type-filter.dto';

@ApiTags('PropertyTypes')
@ApiBearerAuth()
@Controller('property-types')
export class PropertyTypesController {
  constructor(private readonly propertyTypesService: PropertyTypesService) {}

  @Get()
  @RequirePermissions('property-types', 'read', 'station')
  @ApiOperation({ summary: 'List all property types with filters and pagination' })
  async findAll(@Query() filters: PropertyTypeFilterDto) {
    return this.propertyTypesService.findAll(filters);
  }

  @Get(':id')
  @RequirePermissions('property-types', 'read', 'station')
  @ApiOperation({ summary: 'Get property type by ID' })
  async findById(@Param('id') id: string) {
    return this.propertyTypesService.findById(id);
  }

  @Post()
  @RequirePermissions('settings', 'update', 'national')
  @ApiOperation({ summary: 'Create a new property type' })
  async create(
    @Body() data: CreatePropertyTypeDto,
    @CurrentUser('id') officerId: string,
  ) {
    return this.propertyTypesService.create(data, officerId);
  }

  @Patch(':id')
  @RequirePermissions('settings', 'update', 'national')
  @ApiOperation({ summary: 'Update a property type' })
  async update(
    @Param('id') id: string,
    @Body() data: UpdatePropertyTypeDto,
    @CurrentUser('id') officerId: string,
  ) {
    return this.propertyTypesService.update(id, data, officerId);
  }

  @Delete(':id')
  @RequirePermissions('settings', 'update', 'national')
  @ApiOperation({ summary: 'Delete a property type (soft delete)' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') officerId: string,
  ) {
    return this.propertyTypesService.delete(id, officerId);
  }
}
