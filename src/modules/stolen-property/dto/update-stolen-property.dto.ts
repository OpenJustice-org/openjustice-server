import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateStolenPropertyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stationId?: string;
}
