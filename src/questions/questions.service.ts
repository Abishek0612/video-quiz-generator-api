import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question, QuestionDocument } from './schemas/question.schema';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { AiServiceService } from '../ai-service/ai-service.service';
import { VideoDocument } from '../videos/schemas/video.schema';
import { ExportFormat } from './dto/export-questions.dto';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    private aiService: AiServiceService,
  ) {}

  async generateQuestionsForVideo(video: VideoDocument): Promise<void> {
    const promises = video.transcriptionSegments.map(async (segment) => {
      const generatedQuestions = await this.aiService.generateQuestions({
        text: segment.text,
        segmentIndex: segment.segmentIndex,
        startTime: segment.startTime,
        endTime: segment.endTime,
        language: video.language || 'en',
        questionCount: 3,
      });

      const questions = generatedQuestions.map((gq) => ({
        videoId: video._id,
        segmentIndex: segment.segmentIndex,
        startTime: segment.startTime,
        endTime: segment.endTime,
        type: gq.type as any,
        question: gq.question,
        options: gq.options,
        correctAnswer: gq.correctAnswer,
        explanation: gq.explanation,
        difficulty: gq.difficulty as any,
        sourceText: segment.text,
        createdBy: video.uploadedBy,
      }));

      return this.questionModel.insertMany(questions);
    });

    await Promise.all(promises);
  }

  async findByVideoId(videoId: string): Promise<QuestionDocument[]> {
    return this.questionModel
      .find({ videoId: new Types.ObjectId(videoId), isActive: true })
      .sort({ segmentIndex: 1 })
      .exec();
  }

  async findOne(id: string): Promise<QuestionDocument> {
    const question = await this.questionModel.findById(id).exec();
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  async update(
    id: string,
    updateDto: UpdateQuestionDto,
    userId: string,
  ): Promise<QuestionDocument> {
    const question = await this.findOne(id);
    Object.assign(question, updateDto);
    question.lastModifiedBy = new Types.ObjectId(userId);
    return question.save();
  }

  async deleteQuestionsByVideoId(videoId: string): Promise<void> {
    await this.questionModel.deleteMany({
      videoId: new Types.ObjectId(videoId),
    });
  }

  async exportQuestions(videoId: string, format: ExportFormat): Promise<any> {
    const questions = await this.findByVideoId(videoId);

    switch (format) {
      case ExportFormat.JSON:
        return this.exportAsJson(questions);
      case ExportFormat.CSV:
        return this.exportAsCsv(questions);
      case ExportFormat.MOODLE:
        return this.exportAsMoodle(questions);
      default:
        return this.exportAsJson(questions);
    }
  }

  private exportAsJson(questions: QuestionDocument[]) {
    return {
      totalQuestions: questions.length,
      questions: questions.map((q) => ({
        id: q._id,
        segmentIndex: q.segmentIndex,
        timeRange: `${q.startTime}-${q.endTime}`,
        type: q.type,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        tags: q.tags,
      })),
    };
  }

  private exportAsCsv(questions: QuestionDocument[]): string {
    const headers = [
      'Segment',
      'Time Range',
      'Question',
      'Option A',
      'Option B',
      'Option C',
      'Option D',
      'Correct Answer',
      'Explanation',
      'Difficulty',
    ];

    const rows = questions.map((q) => [
      q.segmentIndex,
      `${q.startTime}-${q.endTime}`,
      q.question,
      q.options[0] || '',
      q.options[1] || '',
      q.options[2] || '',
      q.options[3] || '',
      q.correctAnswer,
      q.explanation || '',
      q.difficulty,
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  private exportAsMoodle(questions: QuestionDocument[]): string {
    // Moodle XML format
    const xml = questions
      .map(
        (q) => `
<question type="multichoice">
  <name><text>${q.question.substring(0, 30)}...</text></name>
  <questiontext format="html">
    <text><![CDATA[${q.question}]]></text>
  </questiontext>
  <defaultgrade>1.0000000</defaultgrade>
  <penalty>0.3333333</penalty>
  <hidden>0</hidden>
  <single>true</single>
  <shuffleanswers>true</shuffleanswers>
  <answernumbering>abc</answernumbering>
  ${q.options
    .map(
      (option, index) => `
  <answer fraction="${option === q.correctAnswer ? '100' : '0'}">
    <text>${option}</text>
    <feedback><text>${
      option === q.correctAnswer ? q.explanation || 'Correct!' : 'Incorrect'
    }</text></feedback>
  </answer>`,
    )
    .join('')}
</question>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
${xml}
</quiz>`;
  }
}
