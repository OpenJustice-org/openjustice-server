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
import { StolenPropertyService } from './stolen-property.service';
import { CreateStolenPropertyDto } from './dto/create-stolen-property.dto';
import { UpdateStolenPropertyDto } from './dto/update-stolen-property.dto';
import { MarkRecoveredDto } from './dto/mark-recovered.dto';
import { StolenPropertyFilterDto } from './dto/stolen-property-filter.dto';

@ApiTags('StolenProperty')
@ApiBearerAuth()
@Controller('stolen-property')
export class StolenPropertyController {
  constructor(
    private readonly stolenPropertyService: StolenPropertyService,
  ) {}

  @Get()
  @RequirePermissions('stolen-property', 'read', 'station')
  @ApiOperation({ summary: 'List all stolen property with filters and pagination' })
  async findAll(@Query() filters: StolenPropertyFilterDto) {
    return this.stolenPropertyService.findAll(filters);
  }

  @Get('search')
  @RequirePermissions('stolen-property', 'read', 'station')
  @ApiOperation({ summary: 'Search stolen property by identifier value' })
  async searchByIdentifier(@Query('value') value: string) {
    return this.stolenPropertyService.searchByIdentifier(value);
  }

  @Get('stats')
  @RequirePermissions('stolen-property', 'read', 'station')
  @ApiOperation({ summary: 'Get stolen property statistics' })
  async getStats(@Query('stationId') stationId?: string) {
    return this.stolenPropertyService.getStats(stationId);
  }

  @Get(':id')
  @RequirePermissions('stolen-property', 'read', 'station')
  @ApiOperation({ summary: 'Get stolen property by ID' })
  async findById(@Param('id') id: string) {
    return this.stolenPropertyService.findById(id);
  }

  @Post()
  @RequirePermissions('stolen-property', 'create', 'station')
  @ApiOperation({ summary: 'Report new stolen property' })
  async create(
    @Body() data: CreateStolenPropertyDto,
    @CurrentUser('id') officerId: string,
  ) {
    return this.stolenPropertyService.create(data, officerId);
  }

  @Patch(':id')
  @RequirePermissions('stolen-property', 'update', 'station')
  @ApiOperation({ summary: 'Update stolen property details' })
  async update(
    @Param('id') id: string,
    @Body() data: UpdateStolenPropertyDto,
    @CurrentUser('id') officerId: string,
  ) {
    return this.stolenPropertyService.update(id, data, officerId);
  }

  @Post(':id/mark-stolen')
  @RequirePermissions('stolen-property', 'update', 'station')
  @ApiOperation({ summary: 'Mark reported property as stolen (confirmed)' })
  async markStolen(
    @Param('id') id: string,
    @CurrentUser('id') officerId: string,
  ) {
    return this.stolenPropertyService.markStolen(id, officerId);
  }

  @Post(':id/mark-recovered')
  @RequirePermissions('stolen-property', 'update', 'station')
  @ApiOperation({ summary: 'Mark stolen property as recovered' })
  async markRecovered(
    @Param('id') id: string,
    @Body() dto: MarkRecoveredDto,
    @CurrentUser('id') officerId: string,
  ) {
    return this.stolenPropertyService.markRecovered(id, dto, officerId);
  }

  @Delete(':id')
  @RequirePermissions('stolen-property', 'delete', 'national')
  @ApiOperation({ summary: 'Delete stolen property record' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') officerId: string,
  ) {
    return this.stolenPropertyService.delete(id, officerId);
  }
}
