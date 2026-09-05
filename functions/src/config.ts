export const FUNCTION_REGION = "us-central1";

export const ANALYTICS_PATHS = {
  live: "visitorAnalytics/live",
  onlineCount: "analyticsPublic/onlineCount",
  visits: "analytics_visits",
  daily: "analytics_daily",
  dailyShards: "analyticsDailyShards",
} as const;

export const ANALYTICS_LIMITS = {
  dailyShardCount: 16,
  geoIpTimeoutMs: 2_500,
  presenceMaxAgeMs: 2 * 60 * 1_000,
  visitRetentionMs: 90 * 24 * 60 * 60 * 1_000,
  cleanupBatchSize: 500,
  cleanupMaxBatches: 20,
} as const;

