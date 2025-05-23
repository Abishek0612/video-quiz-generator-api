import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionDto } from './create-question.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {
  @IsBoolean()
  @IsOptional()
  isReviewed?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
