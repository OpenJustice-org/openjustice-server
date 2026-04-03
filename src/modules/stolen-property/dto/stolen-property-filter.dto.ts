import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class StolenPropertyFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['reported', 'stolen', 'recovered'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  propertyTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerNIN?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search across referenceNumber, brand, model, ownerName, ownerPhone' })
  @IsOptional()
  @IsString()
  search?: string;
}
