import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ExportQuestionsDto, ExportFormat } from './dto/export-questions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface CurrentUserType {
  userId: string;
  email: string;
  role: string;
}

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get('video/:videoId')
  @ApiOperation({ summary: 'Get all questions for a video' })
  async findByVideo(@Param('videoId') videoId: string) {
    return this.questionsService.findByVideoId(videoId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get question by ID' })
  async findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a question' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateQuestionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.questionsService.update(id, updateDto, user.userId);
  }

  @Get('video/:videoId/export')
  @ApiOperation({ summary: 'Export questions for a video' })
  async export(
    @Param('videoId') videoId: string,
    @Query() exportDto: ExportQuestionsDto,
    @Res() res: Response,
  ) {
    const format = exportDto.format || ExportFormat.JSON;
    const data = await this.questionsService.exportQuestions(videoId, format);

    switch (format) {
      case ExportFormat.CSV:
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=questions.csv',
        );
        res.send(data);
        break;
      case ExportFormat.MOODLE:
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=questions.xml',
        );
        res.send(data);
        break;
      default:
        res.json(data);
    }
  }
}
