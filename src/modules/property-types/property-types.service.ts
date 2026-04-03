import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { PropertyTypesRepository } from './property-types.repository';
import { CreatePropertyTypeDto } from './dto/create-property-type.dto';
import { UpdatePropertyTypeDto } from './dto/update-property-type.dto';
import { PropertyTypeFilterDto } from './dto/property-type-filter.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

@Injectable()
export class PropertyTypesService {
  private readonly logger = new Logger(PropertyTypesService.name);

  constructor(
    private readonly propertyTypesRepository: PropertyTypesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(filters: PropertyTypeFilterDto) {
    const { data, total } = await this.propertyTypesRepository.findAll(filters);
    return new PaginatedResponseDto(
      data,
      total,
      filters.page || 1,
      filters.limit || 20,
    );
  }

  async findById(id: string) {
    const propertyType = await this.propertyTypesRepository.findById(id);
    if (!propertyType) {
      throw new NotFoundException(`Property type with ID "${id}" not found`);
    }
    return propertyType;
  }

  async create(data: CreatePropertyTypeDto, officerId: string) {
    const slug = data.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const existing = await this.propertyTypesRepository.findBySlug(slug);
    if (existing) {
      throw new BadRequestException(
        `Property type with name "${data.name}" already exists`,
      );
    }

    const propertyType = await this.propertyTypesRepository.create({
      ...data,
      slug,
    });

    await this.createAuditLog({
      entityType: 'property_type',
      entityId: propertyType.id,
      officerId,
      action: 'create',
      details: {
        name: propertyType.name,
        slug: propertyType.slug,
      },
    });

    this.logger.log(
      `Property type created: ${propertyType.name} by officer ${officerId}`,
    );

    return propertyType;
  }

  async update(id: string, data: UpdatePropertyTypeDto, officerId: string) {
    const existing = await this.propertyTypesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Property type with ID "${id}" not found`);
    }

    const propertyType = await this.propertyTypesRepository.update(id, data);

    await this.createAuditLog({
      entityType: 'property_type',
      entityId: id,
      officerId,
      action: 'update',
      details: { updatedFields: Object.keys(data) },
    });

    return propertyType;
  }

  async delete(id: string, officerId: string) {
    const propertyType = await this.propertyTypesRepository.findById(id);
    if (!propertyType) {
      throw new NotFoundException(`Property type with ID "${id}" not found`);
    }

    await this.propertyTypesRepository.delete(id);

    await this.createAuditLog({
      entityType: 'property_type',
      entityId: id,
      officerId,
      action: 'delete',
      details: {
        name: propertyType.name,
        slug: propertyType.slug,
      },
    });

    this.logger.log(
      `Property type deleted: ${propertyType.name} by officer ${officerId}`,
    );

    return { message: 'Property type deleted successfully' };
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
