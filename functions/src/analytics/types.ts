export const DEVICE_CATEGORIES = [
  "desktop",
  "mobile",
  "tablet",
  "unknown",
] as const;

export type DeviceCategory = typeof DEVICE_CATEGORIES[number];

export interface RegisterVisitInput {
  sessionId: string;
  connectionId: string;
  path: string;
  referrerHost: string;
  language: string;
  deviceCategory: DeviceCategory;
}

export interface ApproximateGeo {
  resolved: boolean;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  flag: string;
}

export interface RegisterVisitResponse {
  created: boolean;
  presencePath: string;
  geo: ApproximateGeo;
}
