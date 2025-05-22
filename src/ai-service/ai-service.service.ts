import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

export interface TranscriptionResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface QuestionGenerationRequest {
  text: string;
  segmentIndex: number;
  startTime: number;
  endTime: number;
  language?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount?: number;
}

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  type: string;
}

@Injectable()
export class AiServiceService {
  private readonly AI_SERVICE_URL =
    process.env.AI_SERVICE_URL || 'http://localhost:8000';

  async transcribeAudio(
    audioPath: string,
    language: string = 'en',
  ): Promise<TranscriptionResult> {
    try {
      const formData = new FormData();
      const audioBuffer = await this.readFileAsBuffer(audioPath);
      formData.append('audio_file', new Blob([audioBuffer]), 'audio.mp4');
      formData.append('language', language);

      const response = await axios.post(
        `${this.AI_SERVICE_URL}/transcribe`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 300000,
        },
      );

      return response.data;
    } catch (error) {
      console.error('Transcription error:', error);
      throw new HttpException(
        'Failed to transcribe audio',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async generateQuestions(
    request: QuestionGenerationRequest,
  ): Promise<GeneratedQuestion[]> {
    try {
      const response = await axios.post(
        `${this.AI_SERVICE_URL}/generate-questions`,
        {
          text: request.text,
          segment_index: request.segmentIndex,
          start_time: request.startTime,
          end_time: request.endTime,
          language: request.language || 'en',
          difficulty: request.difficulty || 'medium',
          question_count: request.questionCount || 3,
        },
        {
          timeout: 120000,
        },
      );

      return response.data.questions;
    } catch (error) {
      console.error('Question generation error:', error);
      throw new HttpException(
        'Failed to generate questions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async checkServiceHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.AI_SERVICE_URL}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private async readFileAsBuffer(filePath: string): Promise<Buffer> {
    const fs = require('fs').promises;
    return await fs.readFile(filePath);
  }
}
