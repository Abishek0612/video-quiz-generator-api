import { ProcessingStatus } from '../schemas/video.schema';

export class VideoResponseDto {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  duration: number;
  status: ProcessingStatus;
  processingProgress: number;
  language: string;
  uploadedAt: Date;
  transcriptionAvailable: boolean;
  questionsCount: number;
}
