import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class MarkRecoveredDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recoveredLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recoveryNotes?: string;
}
