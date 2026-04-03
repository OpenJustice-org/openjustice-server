import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsBoolean, IsInt } from 'class-validator';

export class CreatePropertyTypeDto {
  @ApiProperty({ example: 'Mobile Phone' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: ['IMEI', 'Serial Number'] })
  @IsArray()
  @IsString({ each: true })
  identifierTypes: string[];

  @ApiPropertyOptional({ example: 'smartphone' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
