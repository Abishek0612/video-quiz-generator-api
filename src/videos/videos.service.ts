import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Video, VideoDocument, ProcessingStatus } from './schemas/video.schema';
import { TranscriptionService } from '../transcription/transcription.service';
import { QuestionsService } from '../questions/questions.service';
import * as fs from 'fs';
import * as path from 'path';

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
      });

      const savedVideo = await video.save();

      this.processVideoAsync(savedVideo._id.toString());

      return savedVideo;
    } catch (error) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException('Failed to upload video');
    }
  }

  async processVideoAsync(videoId: string): Promise<void> {
    try {
      const video = await this.videoModel.findById(videoId);
      if (!video) throw new NotFoundException('Video not found');

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

      const questions =
        await this.questionsService.generateQuestionsForVideo(video);

      await this.updateVideoStatus(videoId, ProcessingStatus.COMPLETED, 100);
    } catch (error) {
      await this.updateVideoStatus(
        videoId,
        ProcessingStatus.FAILED,
        0,
        error.message,
      );
    }
  }

  private async updateVideoStatus(
    videoId: string,
    status: ProcessingStatus,
    progress: number,
    error?: string,
  ): Promise<void> {
    await this.videoModel.findByIdAndUpdate(videoId, {
      status,
      processingProgress: progress,
      ...(error && { processingError: error }),
    });
  }

  private async getVideoDuration(filePath: string): Promise<number> {
    return 3600;
  }

  async findAllByUser(userId: string): Promise<VideoDocument[]> {
    return this.videoModel
      .find({ uploadedBy: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string, userId?: string): Promise<VideoDocument> {
    const query = { _id: new Types.ObjectId(id) };
    if (userId) {
      query['uploadedBy'] = new Types.ObjectId(userId);
    }

    const video = await this.videoModel.findOne(query).exec();
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    return video;
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
