export type VisitorDeviceCategory = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface VisitorGeo {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  flag: string;
}

export interface ActiveVisitor {
  id: string;
  sessionId: string;
  connectedAt: number;
  lastSeenAt: number;
  path: string;
  referrerHost: string;
  language: string;
  deviceCategory: VisitorDeviceCategory;
  geo: VisitorGeo;
}

export interface VisitRecord {
  id: string;
  sessionId: string;
  visitedAt: number;
  path: string;
  referrerHost: string;
  language: string;
  deviceCategory: VisitorDeviceCategory;
  geo: VisitorGeo;
}

export interface DailyVisitPoint {
  date: string;
  label: string;
  visits: number;
}

export interface CountryVisitSummary {
  countryCode: string;
  visits: number;
}

export interface VisitorAnalyticsDashboard {
  onlineNow: number;
  visitsToday: number;
  visitsLast30Days: number;
  countriesLast30Days: number;
  dailyVisits: DailyVisitPoint[];
  countryVisits: CountryVisitSummary[];
  activeVisitors: ActiveVisitor[];
  recentVisits: VisitRecord[];
  updatedAt: number;
}

export interface VisitorAnalyticsState {
  loading: boolean;
  error: string | null;
  data: VisitorAnalyticsDashboard;
}

export interface AnalyticsDailyShard {
  date: string;
  visits: number;
  countries?: Record<string, number>;
}
