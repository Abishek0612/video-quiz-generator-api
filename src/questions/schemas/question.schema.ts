import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuestionDocument = Question & Document;

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  FILL_IN_BLANK = 'fill_in_blank',
}

export enum QuestionDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

@Schema({ timestamps: true })
export class Question {
  @Prop({ type: Types.ObjectId, ref: 'Video', required: true })
  videoId: Types.ObjectId;

  @Prop({ required: true })
  segmentIndex: number;

  @Prop({ required: true })
  startTime: number;

  @Prop({ required: true })
  endTime: number;

  @Prop({
    type: String,
    enum: QuestionType,
    default: QuestionType.MULTIPLE_CHOICE,
  })
  type: QuestionType;

  @Prop({ required: true })
  question: string;

  @Prop([{ type: String }])
  options: string[];

  @Prop({ required: true })
  correctAnswer: string;

  @Prop()
  explanation: string;

  @Prop({
    type: String,
    enum: QuestionDifficulty,
    default: QuestionDifficulty.MEDIUM,
  })
  difficulty: QuestionDifficulty;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastModifiedBy: Types.ObjectId;

  @Prop({ default: false })
  isReviewed: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  tags: string[];

  @Prop()
  sourceText: string;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
