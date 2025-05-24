import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadVideoDto {
  @ApiProperty({ example: 'en', required: false })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'es', 'fr', 'de', 'hi', 'ta'])
  language?: string;
}
