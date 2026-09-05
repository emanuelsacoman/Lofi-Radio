import { HttpsError } from "firebase-functions/v2/https";

import {
  DEVICE_CATEGORIES,
  DeviceCategory,
  RegisterVisitInput,
} from "./types";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const LANGUAGE_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const DOMAIN_PATTERN = /^(?:localhost|(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)$/;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const BRACKETED_IPV6_PATTERN = /^\[[0-9A-Fa-f:.]+\]$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

export function validateRegisterVisitInput(value: unknown): RegisterVisitInput {
  if (!isPlainObject(value)) {
    throw invalidArgument("The request body must be an object.");
  }

  const sessionId = validateIdentifier(value["sessionId"], "sessionId");
  const connectionId = validateIdentifier(value["connectionId"], "connectionId");
  const path = validatePath(value["path"]);
  const referrerHost = validateReferrerHost(value["referrerHost"]);
  const language = validateLanguage(value["language"]);
  const deviceCategory = validateDeviceCategory(value["deviceCategory"]);

  return {
    sessionId,
    connectionId,
    path,
    referrerHost,
    language,
    deviceCategory,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateIdentifier(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw invalidArgument(`${fieldName} must be an 8 to 80 character URL-safe identifier.`);
  }

  return value;
}

function validatePath(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "/";
  }

  if (
    typeof value !== "string" ||
    value.length > 160 ||
    !value.startsWith("/") ||
    value.includes("?") ||
    value.includes("#") ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw invalidArgument("path must be an absolute URL path without a query string or fragment.");
  }

  return value;
}

function validateReferrerHost(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value !== "string") {
    throw invalidArgument("referrerHost must be a hostname.");
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized.length > 120 ||
    (!DOMAIN_PATTERN.test(normalized) &&
      !IPV4_PATTERN.test(normalized) &&
      !BRACKETED_IPV6_PATTERN.test(normalized))
  ) {
    throw invalidArgument("referrerHost must be a valid hostname without a scheme, path, or port.");
  }

  return normalized;
}

function validateLanguage(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "unknown";
  }

  if (
    typeof value !== "string" ||
    value.length > 16 ||
    !LANGUAGE_PATTERN.test(value)
  ) {
    throw invalidArgument("language must be a valid language tag.");
  }

  return value;
}

function validateDeviceCategory(value: unknown): DeviceCategory {
  if (value === undefined || value === null || value === "") {
    return "unknown";
  }

  if (
    typeof value !== "string" ||
    !DEVICE_CATEGORIES.includes(value as DeviceCategory)
  ) {
    throw invalidArgument(`deviceCategory must be one of: ${DEVICE_CATEGORIES.join(", ")}.`);
  }

  return value as DeviceCategory;
}

function invalidArgument(message: string): HttpsError {
  return new HttpsError("invalid-argument", message);
}
