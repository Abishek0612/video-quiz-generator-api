import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadVideoDto {
  @ApiProperty({ type: 'string', format: 'binary', required: true })
  file: Express.Multer.File;

  @ApiProperty({ example: 'en', required: false })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'es', 'fr', 'de', 'hi', 'ta'])
  language?: string;
}
