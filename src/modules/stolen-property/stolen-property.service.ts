import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { StolenPropertyRepository } from './stolen-property.repository';
import { CreateStolenPropertyDto } from './dto/create-stolen-property.dto';
import { UpdateStolenPropertyDto } from './dto/update-stolen-property.dto';
import { MarkRecoveredDto } from './dto/mark-recovered.dto';
import { StolenPropertyFilterDto } from './dto/stolen-property-filter.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

@Injectable()
export class StolenPropertyService {
  private readonly logger = new Logger(StolenPropertyService.name);

  constructor(
    private readonly stolenPropertyRepository: StolenPropertyRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(filters: StolenPropertyFilterDto) {
    const { data, total } =
      await this.stolenPropertyRepository.findAll(filters);
    return new PaginatedResponseDto(
      data,
      total,
      filters.page || 1,
      filters.limit || 20,
    );
  }

  async findById(id: string) {
    const property = await this.stolenPropertyRepository.findById(id);
    if (!property) {
      throw new NotFoundException(
        `Stolen property with ID "${id}" not found`,
      );
    }
    return property;
  }

  async searchByIdentifier(value: string) {
    const results =
      await this.stolenPropertyRepository.searchByIdentifier(value);

    const stolenMatches = results.filter(
      (r) => r.stolenProperty.status === 'stolen',
    );

    if (stolenMatches.length > 0) {
      const matchedPropertyIds = [
        ...new Set(stolenMatches.map((r) => r.stolenProperty.id)),
      ];
      const matchedStationIds = [
        ...new Set(stolenMatches.map((r) => r.stolenProperty.stationId)),
      ];

      await this.createAuditLog({
        entityType: 'stolen_property',
        entityId: matchedPropertyIds[0],
        officerId: 'system',
        action: 'stolen_property_lookup_hit',
        details: {
          searchTerm: value,
          matchedPropertyIds,
          matchedStationIds,
        },
      });

      this.logger.warn(
        `Stolen property lookup hit for "${value}" — ${matchedPropertyIds.length} match(es)`,
      );
    }

    return results;
  }

  async getStats(stationId?: string) {
    return this.stolenPropertyRepository.getStats(stationId);
  }

  async create(data: CreateStolenPropertyDto, officerId: string) {
    const { identifiers, ...propertyData } = data;

    const property = await this.stolenPropertyRepository.create(
      { ...propertyData, reportedById: officerId },
      identifiers,
    );

    await this.createAuditLog({
      entityType: 'stolen_property',
      entityId: property.id,
      officerId,
      action: 'create',
      details: {
        referenceNumber: property.referenceNumber,
        propertyTypeId: property.propertyTypeId,
        stationId: property.stationId,
      },
    });

    this.logger.log(
      `Stolen property created: ${property.referenceNumber} by officer ${officerId}`,
    );

    return property;
  }

  async update(id: string, data: UpdateStolenPropertyDto, officerId: string) {
    const existing = await this.stolenPropertyRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(
        `Stolen property with ID "${id}" not found`,
      );
    }

    const updateData: Record<string, any> = {};
    if (data.brand !== undefined) updateData.brand = data.brand;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.ownerName !== undefined) updateData.ownerName = data.ownerName;
    if (data.ownerNIN !== undefined) updateData.ownerNIN = data.ownerNIN;
    if (data.ownerPhone !== undefined) updateData.ownerPhone = data.ownerPhone;
    if (data.ownerAddress !== undefined) updateData.ownerAddress = data.ownerAddress;
    if (data.stolenDate !== undefined) updateData.stolenDate = new Date(data.stolenDate);
    if (data.stolenLocation !== undefined) updateData.stolenLocation = data.stolenLocation;
    if (data.circumstances !== undefined) updateData.circumstances = data.circumstances;
    if (data.stationId !== undefined) updateData.stationId = data.stationId;

    const property = await this.stolenPropertyRepository.update(id, updateData);

    await this.createAuditLog({
      entityType: 'stolen_property',
      entityId: id,
      officerId,
      action: 'update',
      details: { updatedFields: Object.keys(data) },
    });

    return property;
  }

  async markStolen(id: string, officerId: string) {
    const existing = await this.stolenPropertyRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(
        `Stolen property with ID "${id}" not found`,
      );
    }

    if (existing.status !== 'reported') {
      throw new BadRequestException(
        'Only properties with status "reported" can be marked as stolen',
      );
    }

    const property = await this.stolenPropertyRepository.markStolen(id);

    await this.createAuditLog({
      entityType: 'stolen_property',
      entityId: id,
      officerId,
      action: 'mark_stolen',
      details: {
        referenceNumber: existing.referenceNumber,
        previousStatus: existing.status,
      },
    });

    this.logger.warn(
      `Property marked stolen: ${existing.referenceNumber} by officer ${officerId}`,
    );

    return property;
  }

  async markRecovered(id: string, dto: MarkRecoveredDto, officerId: string) {
    const existing = await this.stolenPropertyRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(
        `Stolen property with ID "${id}" not found`,
      );
    }

    if (existing.status !== 'stolen') {
      throw new BadRequestException(
        'Only stolen properties can be marked as recovered',
      );
    }

    const property = await this.stolenPropertyRepository.markRecovered(
      id,
      dto.recoveredLocation,
      dto.recoveryNotes,
    );

    await this.createAuditLog({
      entityType: 'stolen_property',
      entityId: id,
      officerId,
      action: 'mark_recovered',
      details: {
        referenceNumber: existing.referenceNumber,
        stolenDate: existing.stolenDate,
        recoveredDate: property.recoveredDate,
        recoveredLocation: dto.recoveredLocation,
      },
    });

    this.logger.log(
      `Property recovered: ${existing.referenceNumber} by officer ${officerId}`,
    );

    return property;
  }

  async delete(id: string, officerId: string) {
    const property = await this.stolenPropertyRepository.findById(id);
    if (!property) {
      throw new NotFoundException(
        `Stolen property with ID "${id}" not found`,
      );
    }

    await this.stolenPropertyRepository.delete(id);

    await this.createAuditLog({
      entityType: 'stolen_property',
      entityId: id,
      officerId,
      action: 'delete',
      details: {
        referenceNumber: property.referenceNumber,
        propertyTypeId: property.propertyTypeId,
      },
    });

    this.logger.log(
      `Stolen property deleted: ${property.referenceNumber} by officer ${officerId}`,
    );

    return { message: 'Stolen property deleted successfully' };
  }

  private async createAuditLog(data: {
    entityType: string;
    entityId: string;
    officerId: string;
    action: string;
    details: Record<string, any>;
  }) {
    await this.prisma.auditLog.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        officerId: data.officerId,
        action: data.action,
        details: data.details,
        success: true,
      },
    });
  }
}
