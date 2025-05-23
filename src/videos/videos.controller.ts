import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadVideoDto } from './dto/upload-video.dto';

@ApiTags('videos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a video for processing' })
  @ApiResponse({ status: 201, description: 'Video uploaded successfully' })
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadVideoDto: UploadVideoDto,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.videosService.uploadVideo(
      file,
      user.userId,
      uploadVideoDto.language,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all videos for current user' })
  @ApiResponse({ status: 200, description: 'List of user videos' })
  async findAll(@CurrentUser() user: any) {
    return this.videosService.findAllByUser(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get video details' })
  @ApiResponse({ status: 200, description: 'Video details' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.videosService.findOne(id, user.userId);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get video processing status' })
  @ApiResponse({ status: 200, description: 'Processing status' })
  async getStatus(@Param('id') id: string, @CurrentUser() user: any) {
    return this.videosService.getProcessingStatus(id, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a video' })
  @ApiResponse({ status: 200, description: 'Video deleted successfully' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.videosService.deleteVideo(id, user.userId);
    return { message: 'Video deleted successfully' };
  }
}
