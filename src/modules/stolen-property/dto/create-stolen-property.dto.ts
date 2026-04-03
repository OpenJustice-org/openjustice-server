import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, ArrayMinSize, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePropertyIdentifierDto } from './create-property-identifier.dto';

export class CreateStolenPropertyDto {
  @ApiProperty({ description: 'Property type ID' })
  @IsString()
  propertyTypeId: string;

  @ApiPropertyOptional({ example: 'Samsung' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 'Galaxy S24' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 'black' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  ownerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerNIN?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  stolenDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stolenLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  circumstances?: string;

  @ApiPropertyOptional({ description: 'Station ID where report is filed. Defaults to officer\'s station if omitted.' })
  @IsOptional()
  @IsString()
  stationId?: string;

  @ApiProperty({ type: [CreatePropertyIdentifierDto], description: 'At least one identifier required' })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreatePropertyIdentifierDto)
  identifiers: CreatePropertyIdentifierDto[];
}
