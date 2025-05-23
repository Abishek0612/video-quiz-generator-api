import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Video, VideoDocument, ProcessingStatus } from './schemas/video.schema';
import { TranscriptionService } from '../transcription/transcription.service';
import { QuestionsService } from '../questions/questions.service';
import * as fs from 'fs';
import * as ffmpeg from 'fluent-ffmpeg';

@Injectable()
export class VideosService {
  constructor(
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    private transcriptionService: TranscriptionService,
    private questionsService: QuestionsService,
  ) {}

  async uploadVideo(
    file: Express.Multer.File,
    userId: string,
    language?: string,
  ): Promise<VideoDocument> {
    try {
      const duration = await this.getVideoDuration(file.path);

      const video = new this.videoModel({
        filename: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        duration,
        uploadedBy: new Types.ObjectId(userId),
        status: ProcessingStatus.UPLOADED,
        language: language || 'en',
      });

      const savedVideo = await video.save();

      // Process video asynchronously without blocking
      void this.processVideoAsync(
        (savedVideo._id as Types.ObjectId).toString(),
      );

      return savedVideo;
    } catch (error) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException('Failed to upload video');
    }
  }

  async processVideoAsync(videoId: string): Promise<void> {
    let video: VideoDocument | null = null;

    try {
      video = await this.videoModel.findById(videoId);
      if (!video) throw new NotFoundException('Video not found');

      const userId = (video.uploadedBy as Types.ObjectId).toString();

      await this.updateVideoStatus(videoId, ProcessingStatus.TRANSCRIBING, 10);

      const transcription = await this.transcriptionService.transcribeVideo(
        video.filePath,
        video.language || 'en',
      );

      video.transcriptionText = transcription.fullText;
      video.transcriptionSegments = transcription.segments;
      await video.save();

      await this.updateVideoStatus(
        videoId,
        ProcessingStatus.GENERATING_QUESTIONS,
        60,
      );

      await this.questionsService.generateQuestionsForVideo(video);

      await this.updateVideoStatus(videoId, ProcessingStatus.COMPLETED, 100);
    } catch (error) {
      console.error('Video processing error:', error);
      await this.updateVideoStatus(
        videoId,
        ProcessingStatus.FAILED,
        0,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  private async updateVideoStatus(
    videoId: string,
    status: ProcessingStatus,
    progress: number,
    error?: string,
  ): Promise<void> {
    const updateData: Partial<VideoDocument> = {
      status,
      processingProgress: progress,
    };

    if (error) {
      updateData.processingError = error;
    }

    await this.videoModel.findByIdAndUpdate(videoId, updateData);
  }

  private async getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err: Error | null, metadata: any) => {
        if (err) {
          reject(new Error(`Failed to get video duration: ${err.message}`));
        } else {
          resolve(metadata?.format?.duration || 0);
        }
      });
    });
  }

  async findAllByUser(userId: string): Promise<VideoDocument[]> {
    return this.videoModel
      .find({ uploadedBy: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string, userId?: string): Promise<VideoDocument> {
    const query: any = { _id: new Types.ObjectId(id) };
    if (userId) {
      query.uploadedBy = new Types.ObjectId(userId);
    }

    const video = await this.videoModel.findOne(query).exec();
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    return video;
  }

  async getProcessingStatus(id: string, userId: string) {
    const video = await this.findOne(id, userId);
    return {
      status: video.status,
      progress: video.processingProgress,
      error: video.processingError,
    };
  }

  async deleteVideo(id: string, userId: string): Promise<void> {
    const video = await this.findOne(id, userId);

    if (fs.existsSync(video.filePath)) {
      fs.unlinkSync(video.filePath);
    }

    await this.questionsService.deleteQuestionsByVideoId(id);
    await this.videoModel.findByIdAndDelete(id);
  }
}
