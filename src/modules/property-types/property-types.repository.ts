import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { PropertyTypeFilterDto } from './dto/property-type-filter.dto';
import { CreatePropertyTypeDto } from './dto/create-property-type.dto';
import { UpdatePropertyTypeDto } from './dto/update-property-type.dto';

@Injectable()
export class PropertyTypesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: PropertyTypeFilterDto) {
    const where: Prisma.PropertyTypeWhereInput = {};

    if (filters.active !== undefined) {
      where.active = filters.active;
    }
    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.propertyType.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.propertyType.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.propertyType.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.propertyType.findUnique({
      where: { slug },
    });
  }

  async create(data: CreatePropertyTypeDto & { slug: string }) {
    return this.prisma.propertyType.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        identifierTypes: data.identifierTypes,
        icon: data.icon,
        active: data.active ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, data: UpdatePropertyTypeDto) {
    return this.prisma.propertyType.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.identifierTypes !== undefined && { identifierTypes: data.identifierTypes }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  async delete(id: string) {
    return this.prisma.propertyType.update({
      where: { id },
      data: { active: false },
    });
  }
}
