import { Injectable } from '@nestjs/common';
import { AiServiceService } from '../ai-service/ai-service.service';
import { TranscriptionResponseDto } from './dto/transcription.dto';

@Injectable()
export class TranscriptionService {
  constructor(private aiService: AiServiceService) {}

  async transcribeVideo(
    videoPath: string,
    language: string = 'en',
  ): Promise<TranscriptionResponseDto> {
    const transcriptionResult = await this.aiService.transcribeAudio(
      videoPath,
      language,
    );

    const segments = this.segmentTranscription(
      transcriptionResult.segments,
      300, // 5 minutes in seconds
    );

    return {
      fullText: transcriptionResult.text,
      segments,
      language,
      duration: segments[segments.length - 1]?.endTime || 0,
    };
  }

  private segmentTranscription(
    rawSegments: Array<{ start: number; end: number; text: string }>,
    segmentDuration: number,
  ) {
    const segments = [];
    let currentSegment = {
      startTime: 0,
      endTime: 0,
      text: '',
      segmentIndex: 0,
    };

    for (const rawSegment of rawSegments) {
      if (rawSegment.start >= currentSegment.startTime + segmentDuration) {
        if (currentSegment.text) {
          segments.push({ ...currentSegment });
        }
        currentSegment = {
          startTime:
            Math.floor(rawSegment.start / segmentDuration) * segmentDuration,
          endTime: rawSegment.end,
          text: rawSegment.text,
          segmentIndex: segments.length,
        };
      } else {
        currentSegment.text += ' ' + rawSegment.text;
        currentSegment.endTime = rawSegment.end;
      }
    }

    if (currentSegment.text) {
      segments.push(currentSegment);
    }

    return segments;
  }
}
