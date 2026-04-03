import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { StolenPropertyFilterDto } from './dto/stolen-property-filter.dto';

const standardInclude = {
  propertyType: true,
  station: { select: { id: true, name: true, code: true } },
  identifiers: true,
};

@Injectable()
export class StolenPropertyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: StolenPropertyFilterDto) {
    const where: Prisma.StolenPropertyWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.stationId) {
      where.stationId = filters.stationId;
    }
    if (filters.propertyTypeId) {
      where.propertyTypeId = filters.propertyTypeId;
    }
    if (filters.ownerNIN) {
      where.ownerNIN = filters.ownerNIN;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.stolenDate = {};
      if (filters.dateFrom) {
        where.stolenDate.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.stolenDate.lte = new Date(filters.dateTo);
      }
    }
    if (filters.search) {
      where.OR = [
        { referenceNumber: { contains: filters.search, mode: 'insensitive' } },
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { model: { contains: filters.search, mode: 'insensitive' } },
        { ownerName: { contains: filters.search, mode: 'insensitive' } },
        { ownerPhone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.StolenPropertyOrderByWithRelationInput = {};
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.stolenProperty.findMany({
        where,
        include: standardInclude,
        orderBy,
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.stolenProperty.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.stolenProperty.findUnique({
      where: { id },
      include: standardInclude,
    });
  }

  async searchByIdentifier(value: string) {
    return this.prisma.propertyIdentifier.findMany({
      where: {
        valueLower: { contains: value.toLowerCase().trim() },
      },
      include: {
        stolenProperty: {
          include: {
            propertyType: true,
            station: { select: { id: true, name: true, code: true } },
          },
        },
      },
      take: 10,
    });
  }

  async create(
    data: {
      propertyTypeId: string;
      brand?: string;
      model?: string;
      color?: string;
      description?: string;
      ownerName: string;
      ownerNIN?: string;
      ownerPhone?: string;
      ownerAddress?: string;
      stolenDate?: string;
      stolenLocation?: string;
      circumstances?: string;
      stationId: string;
      reportedById: string;
    },
    identifiers: { type: string; value: string }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const count = await tx.stolenProperty.count({
        where: {
          createdAt: { gte: startOfDay },
        },
      });

      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const referenceNumber = `SP-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

      const created = await tx.stolenProperty.create({
        data: {
          referenceNumber,
          propertyTypeId: data.propertyTypeId,
          brand: data.brand,
          model: data.model,
          color: data.color,
          description: data.description,
          ownerName: data.ownerName,
          ownerNIN: data.ownerNIN,
          ownerPhone: data.ownerPhone,
          ownerAddress: data.ownerAddress,
          stolenDate: data.stolenDate ? new Date(data.stolenDate) : null,
          stolenLocation: data.stolenLocation,
          circumstances: data.circumstances,
          stationId: data.stationId,
          reportedById: data.reportedById,
          status: 'reported',
          identifiers: {
            create: identifiers.map((i) => ({
              type: i.type,
              value: i.value,
              valueLower: i.value.toLowerCase().trim(),
            })),
          },
        },
        include: standardInclude,
      });

      return created;
    });
  }

  async update(id: string, data: Record<string, any>) {
    return this.prisma.stolenProperty.update({
      where: { id },
      data,
      include: standardInclude,
    });
  }

  async markStolen(id: string) {
    return this.prisma.stolenProperty.update({
      where: { id },
      data: {
        status: 'stolen',
        stolenDate: new Date(),
      },
      include: standardInclude,
    });
  }

  async markRecovered(
    id: string,
    recoveredLocation?: string,
    recoveryNotes?: string,
  ) {
    return this.prisma.stolenProperty.update({
      where: { id },
      data: {
        status: 'recovered',
        recoveredDate: new Date(),
        recoveredLocation,
        recoveryNotes,
      },
      include: standardInclude,
    });
  }

  async delete(id: string) {
    return this.prisma.stolenProperty.delete({
      where: { id },
    });
  }

  async getStats(stationId?: string) {
    const where: Prisma.StolenPropertyWhereInput = {};
    if (stationId) {
      where.stationId = stationId;
    }

    const [byStatus, byPropertyType] = await Promise.all([
      this.prisma.stolenProperty.groupBy({
        by: ['status'],
        _count: true,
        where,
      }),
      this.prisma.stolenProperty.groupBy({
        by: ['propertyTypeId'],
        _count: true,
        where,
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      byPropertyType: byPropertyType.map((p) => ({
        propertyTypeId: p.propertyTypeId,
        count: p._count,
      })),
    };
  }
}
