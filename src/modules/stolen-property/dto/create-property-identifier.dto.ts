import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreatePropertyIdentifierDto {
  @ApiProperty({ example: 'IMEI', description: 'Identifier type (IMEI, Serial Number, MAC Address, etc.)' })
  @IsString()
  type: string;

  @ApiProperty({ example: '356938035643809' })
  @IsString()
  value: string;
}
