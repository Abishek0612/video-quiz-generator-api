import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoDocument = Video & Document;

export enum ProcessingStatus {
  UPLOADED = 'uploaded',
  TRANSCRIBING = 'transcribing',
  GENERATING_QUESTIONS = 'generating_questions',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Video {
  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  filePath: string;

  @Prop({ required: true })
  fileSize: number;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  duration: number; // in seconds

  @Prop({
    type: String,
    enum: ProcessingStatus,
    default: ProcessingStatus.UPLOADED,
  })
  status: ProcessingStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedBy: Types.ObjectId;

  @Prop()
  transcriptionText: string;

  @Prop([
    {
      startTime: { type: Number, required: true },
      endTime: { type: Number, required: true },
      text: { type: String, required: true },
      segmentIndex: { type: Number, required: true },
    },
  ])
  transcriptionSegments: Array<{
    startTime: number;
    endTime: number;
    text: string;
    segmentIndex: number;
  }>;

  @Prop()
  language: string;

  @Prop()
  processingError: string;

  @Prop({ default: 0 })
  processingProgress: number;
}

export const VideoSchema = SchemaFactory.createForClass(Video);
