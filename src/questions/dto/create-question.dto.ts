import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { QuestionType, QuestionDifficulty } from '../schemas/question.schema';

export class CreateQuestionDto {
  @IsString()
  videoId: string;

  @IsNumber()
  segmentIndex: number;

  @IsNumber()
  startTime: number;

  @IsNumber()
  endTime: number;

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType;

  @IsString()
  question: string;

  @IsArray()
  @IsString({ each: true })
  options: string[];

  @IsString()
  correctAnswer: string;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
