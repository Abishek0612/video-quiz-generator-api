import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Video, VideoDocument } from '../videos/schemas/video.schema';
import {
  Question,
  QuestionDocument,
} from '../questions/schemas/question.schema';
import { AdminStatsDto } from './dto/admin-stats.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
  ) {}

  async getStats(): Promise<AdminStatsDto> {
    const [
      totalUsers,
      activeUsers,
      totalVideos,
      totalQuestions,
      videosByStatus,
      recentVideos,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ isActive: true }),
      this.videoModel.countDocuments(),
      this.questionModel.countDocuments(),
      this.getVideosByStatus(),
      this.getRecentVideos(),
    ]);

    const recentActivity = recentVideos.map((video) => ({
      type: 'video_upload',
      description: `${video.originalName} uploaded`,
      timestamp: video.createdAt,
    }));

    return {
      totalUsers,
      activeUsers,
      totalVideos,
      totalQuestions,
      videosByStatus,
      recentActivity,
    };
  }

  private async getVideosByStatus(): Promise<Record<string, number>> {
    const result = await this.videoModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  private async getRecentVideos(): Promise<any[]> {
    return this.videoModel
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('originalName createdAt')
      .exec();
  }

  async getAllVideos(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [videos, total] = await Promise.all([
      this.videoModel
        .find()
        .populate('uploadedBy', 'email firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.videoModel.countDocuments(),
    ]);

    return {
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getQuestionsByVideo(videoId: string) {
    return this.questionModel
      .find({ videoId })
      .sort({ segmentIndex: 1 })
      .exec();
  }

  async reviewQuestion(questionId: string): Promise<QuestionDocument> {
    return this.questionModel.findByIdAndUpdate(
      questionId,
      { isReviewed: true },
      { new: true },
    );
  }
}
