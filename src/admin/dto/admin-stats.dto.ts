export class AdminStatsDto {
  totalUsers!: number;
  activeUsers!: number;
  totalVideos!: number;
  totalQuestions!: number;
  videosByStatus!: Record<string, number>;
  recentActivity!: Array<{
    type: string;
    description: string;
    timestamp: Date;
  }>;
}
