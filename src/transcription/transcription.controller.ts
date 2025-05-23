import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('transcription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transcription')
export class TranscriptionController {
  // Transcription endpoints are handled through the videos module
}
