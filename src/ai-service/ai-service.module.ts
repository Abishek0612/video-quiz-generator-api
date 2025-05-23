import { Module } from '@nestjs/common';
import { AiServiceService } from './ai-service.service';

@Module({
  providers: [AiServiceService],
  exports: [AiServiceService],
})
export class AiServiceModule {}
