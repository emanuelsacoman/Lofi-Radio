import { createHash } from "node:crypto";

import { getDatabase, ServerValue } from "firebase-admin/database";
import {
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";

import {
  ANALYTICS_LIMITS,
  ANALYTICS_PATHS,
  FUNCTION_REGION,
} from "../config";
import {
  extractClientIp,
  lookupApproximateGeo,
  normalizeStoredGeo,
} from "./geoip";
import {
  ApproximateGeo,
  RegisterVisitInput,
  RegisterVisitResponse,
} from "./types";
import { validateRegisterVisitInput } from "./validation";

interface PersistVisitResult {
  created: boolean;
  geo: ApproximateGeo;
}

export const registerVisit = onCall(
  {
    region: FUNCTION_REGION,
    memory: "256MiB",
    timeoutSeconds: 15,
  },
  async (request): Promise<RegisterVisitResponse> => {
    const input = validateRegisterVisitInput(request.data);
    const firestore = getFirestore();
    const visitRef = firestore.collection(ANALYTICS_PATHS.visits).doc(input.sessionId);

    // A cheap read avoids consuming GeoIP quota when the browser retries a
    // request whose Firestore transaction already committed.
    const existingVisit = await visitRef.get();
    const candidateGeo = existingVisit.exists
      ? normalizeStoredGeo(existingVisit.data()?.["geo"])
      : await lookupApproximateGeo(extractClientIp(request.rawRequest));

    const persisted = existingVisit.exists
      ? { created: false, geo: candidateGeo }
      : await persistVisit(input, candidateGeo);

    const presencePath = `${ANALYTICS_PATHS.live}/${input.connectionId}`;

    // RTDB server values keep online-state decisions independent from the
    // visitor's clock. A later retry simply refreshes this same connection.
    await getDatabase().ref(presencePath).set({
      sessionId: input.sessionId,
      connectedAt: ServerValue.TIMESTAMP,
      lastSeenAt: ServerValue.TIMESTAMP,
      path: input.path,
      referrerHost: input.referrerHost,
      language: input.language,
      deviceCategory: input.deviceCategory,
      geo: toPresenceGeo(persisted.geo),
    });

    return {
      created: persisted.created,
      presencePath,
      geo: persisted.geo,
    };
  },
);

async function persistVisit(
  input: RegisterVisitInput,
  candidateGeo: ApproximateGeo,
): Promise<PersistVisitResult> {
  const firestore = getFirestore();
  const visitRef = firestore.collection(ANALYTICS_PATHS.visits).doc(input.sessionId);
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const dayRef = firestore.collection(ANALYTICS_PATHS.daily).doc(date);
  const shardNumber = shardFor(input.sessionId);
  const shardId = shardNumber.toString().padStart(2, "0");
  const shardRef = dayRef.collection(ANALYTICS_PATHS.dailyShards).doc(shardId);

  return firestore.runTransaction(async transaction => {
    const visitSnapshot = await transaction.get(visitRef);

    // A concurrent invocation may have won after the preliminary read. The
    // transaction returns its canonical geo and deliberately skips the shard.
    if (visitSnapshot.exists) {
      return {
        created: false,
        geo: normalizeStoredGeo(visitSnapshot.data()?.["geo"]),
      };
    }

    const daySnapshot = await transaction.get(dayRef);
    const shardSnapshot = await transaction.get(shardRef);

    if (!daySnapshot.exists) {
      transaction.create(dayRef, {
        date,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.create(visitRef, {
      sessionId: input.sessionId,
      connectionId: input.connectionId,
      visitedAt: FieldValue.serverTimestamp(),
      date,
      path: input.path,
      referrerHost: input.referrerHost,
      language: input.language,
      deviceCategory: input.deviceCategory,
      geo: candidateGeo,
      expiresAt: Timestamp.fromMillis(now.getTime() + ANALYTICS_LIMITS.visitRetentionMs),
    });

    const countryCode = persistedCountry(candidateGeo);

    if (shardSnapshot.exists) {
      const shardUpdates: Record<string, unknown> = {
        visits: FieldValue.increment(1),
        [`deviceCounts.${input.deviceCategory}`]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (countryCode) {
        shardUpdates[`countries.${countryCode}`] = FieldValue.increment(1);
      }

      transaction.update(shardRef, shardUpdates);
    } else {
      const countries = countryCode
        ? { [countryCode]: 1 }
        : {};

      transaction.create(shardRef, {
        date,
        shard: shardNumber,
        visits: 1,
        countries,
        deviceCounts: {
          [input.deviceCategory]: 1,
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return { created: true, geo: candidateGeo };
  });
}

function shardFor(sessionId: string): number {
  const digest = createHash("sha256").update(sessionId).digest();
  return digest.readUInt16BE(0) % ANALYTICS_LIMITS.dailyShardCount;
}

function persistedCountry(geo: ApproximateGeo): string | null {
  return geo.resolved && /^[A-Z]{2}$/.test(geo.countryCode)
    ? geo.countryCode
    : null;
}

function toPresenceGeo(geo: ApproximateGeo): Omit<ApproximateGeo, "resolved"> {
  return {
    city: geo.city,
    region: geo.region,
    country: geo.country,
    countryCode: geo.countryCode,
    latitude: geo.latitude,
    longitude: geo.longitude,
    timezone: geo.timezone,
    flag: geo.flag,
  };
}
