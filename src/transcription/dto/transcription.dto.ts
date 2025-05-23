export class TranscriptionSegmentDto {
  startTime!: number;
  endTime!: number;
  text!: string;
  segmentIndex!: number;
}

export class TranscriptionResponseDto {
  fullText!: string;
  segments!: TranscriptionSegmentDto[];
  language!: string;
  duration!: number;
}
