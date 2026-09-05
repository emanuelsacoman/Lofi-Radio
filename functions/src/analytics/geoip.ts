import { isIP } from "node:net";

import { logger } from "firebase-functions";
import type { Request } from "firebase-functions/v2/https";

import { ANALYTICS_LIMITS } from "../config";
import { ApproximateGeo } from "./types";

interface IpWhoResponse {
  success?: unknown;
  country?: unknown;
  country_code?: unknown;
  region?: unknown;
  city?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  timezone?: {
    id?: unknown;
  };
  flag?: {
    emoji?: unknown;
  };
}

const UNKNOWN_GEO: ApproximateGeo = {
  resolved: false,
  country: "",
  countryCode: "",
  region: "",
  city: "",
  latitude: null,
  longitude: null,
  timezone: "",
  flag: "",
};

/**
 * Reads the address attached by Google Cloud's HTTPS proxy. No address supplied
 * by callable data is accepted. Every candidate is parsed before it leaves the
 * function, which also prevents path/query injection into the provider URL.
 */
export function extractClientIp(request: Request): string | null {
  const forwardedHeader = request.headers["x-forwarded-for"];
  const forwardedValues = (Array.isArray(forwardedHeader)
    ? forwardedHeader
    : typeof forwardedHeader === "string"
      ? forwardedHeader.split(",")
      : [])
    .flatMap(value => value.split(","))
    .map(value => value.trim())
    .filter(Boolean);

  // Google's external HTTPS load balancer appends `<client>,<load-balancer>`
  // to any value supplied by the caller. Reading from the end avoids trusting
  // spoofable entries that a caller may have placed at the start of the list.
  const platformClient = forwardedValues.length >= 2
    ? forwardedValues[forwardedValues.length - 2]
    : forwardedValues[0];

  const candidates = [
    platformClient,
    request.ip,
    request.socket?.remoteAddress,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIp(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export async function lookupApproximateGeo(ip: string | null): Promise<ApproximateGeo> {
  if (!ip || isNonPublicIp(ip)) {
    return { ...UNKNOWN_GEO };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYTICS_LIMITS.geoIpTimeoutMs);

  try {
    const url = new URL(`https://ipwho.is/${encodeURIComponent(ip)}`);
    url.searchParams.set(
      "fields",
      "success,country,country_code,region,city,latitude,longitude,timezone.id,flag.emoji",
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "lofi-radio-visit-monitor/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn("GeoIP lookup returned a non-success HTTP status.", {
        status: response.status,
      });
      return { ...UNKNOWN_GEO };
    }

    const data = await response.json() as IpWhoResponse;

    if (data.success !== true) {
      logger.warn("GeoIP provider could not resolve a visitor location.");
      return { ...UNKNOWN_GEO };
    }

    const latitude = roundedCoordinate(data.latitude, -90, 90);
    const longitude = roundedCoordinate(data.longitude, -180, 180);
    const countryCode = normalizedCountryCode(data.country_code);

    return {
      resolved: countryCode !== "" || (latitude !== null && longitude !== null),
      country: safeLabel(data.country),
      countryCode,
      region: safeLabel(data.region),
      city: safeLabel(data.city),
      latitude,
      longitude,
      timezone: safeOptionalLabel(data.timezone?.id, 80),
      flag: safeOptionalLabel(data.flag?.emoji, 8),
    };
  } catch (error: unknown) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? "timeout"
      : "request-failed";
    logger.warn("GeoIP lookup failed; continuing without a location.", { reason });
    return { ...UNKNOWN_GEO };
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeStoredGeo(value: unknown): ApproximateGeo {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ...UNKNOWN_GEO };
  }

  const candidate = value as Record<string, unknown>;
  const latitude = roundedCoordinate(candidate["latitude"], -90, 90);
  const longitude = roundedCoordinate(candidate["longitude"], -180, 180);
  const countryCode = normalizedCountryCode(candidate["countryCode"]);

  return {
    resolved: candidate["resolved"] === true &&
      (countryCode !== "" || (latitude !== null && longitude !== null)),
    country: safeLabel(candidate["country"]),
    countryCode,
    region: safeLabel(candidate["region"]),
    city: safeLabel(candidate["city"]),
    latitude,
    longitude,
    timezone: safeOptionalLabel(candidate["timezone"], 80),
    flag: safeOptionalLabel(candidate["flag"], 8),
  };
}

function normalizeIp(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  let candidate = value.trim();

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  }

  if (candidate.toLowerCase().startsWith("::ffff:")) {
    const mappedIpv4 = candidate.slice(7);
    if (isIP(mappedIpv4) === 4) {
      candidate = mappedIpv4;
    }
  }

  const zoneIndex = candidate.indexOf("%");
  if (zoneIndex >= 0) {
    candidate = candidate.slice(0, zoneIndex);
  }

  return isIP(candidate) ? candidate : null;
}

function isNonPublicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const octets = ip.split(".").map(Number);
    const [first, second] = octets;

    return first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 192 && second === 0) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224;
  }

  const normalized = ip.toLowerCase();
  return normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("2001:db8:");
}

function roundedCoordinate(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizedCountryCode(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

function safeLabel(value: unknown): string {
  if (typeof value !== "string") {
    return "Unknown";
  }

  return value.trim().replace(CONTROL_CHARACTER_PATTERN, "").slice(0, 100);
}

function safeOptionalLabel(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(CONTROL_CHARACTER_PATTERN, "").slice(0, maxLength);
}

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/g;
