import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('videos')
  @ApiOperation({ summary: 'Get all videos with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllVideos(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getAllVideos(page, limit);
  }

  @Get('videos/:videoId/questions')
  @ApiOperation({ summary: 'Get all questions for a video' })
  async getVideoQuestions(@Param('videoId') videoId: string) {
    return this.adminService.getQuestionsByVideo(videoId);
  }

  @Patch('questions/:questionId/review')
  @ApiOperation({ summary: 'Mark a question as reviewed' })
  async reviewQuestion(@Param('questionId') questionId: string) {
    return this.adminService.reviewQuestion(questionId);
  }
}
