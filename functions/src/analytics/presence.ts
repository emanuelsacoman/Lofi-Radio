import { getDatabase } from "firebase-admin/database";
import { logger } from "firebase-functions";
import {
  onValueCreated,
  onValueDeleted,
} from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
  ANALYTICS_LIMITS,
  ANALYTICS_PATHS,
  FUNCTION_REGION,
} from "../config";

const LIVE_TRIGGER_PATH = `${ANALYTICS_PATHS.live}/{connectionId}`;

export const incrementOnlineCount = onValueCreated(
  {
    ref: LIVE_TRIGGER_PATH,
    region: FUNCTION_REGION,
  },
  async () => updateOnlineCount(1),
);

export const decrementOnlineCount = onValueDeleted(
  {
    ref: LIVE_TRIGGER_PATH,
    region: FUNCTION_REGION,
  },
  async () => updateOnlineCount(-1),
);

export const cleanupStalePresence = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Etc/UTC",
    region: FUNCTION_REGION,
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const liveRef = getDatabase().ref(ANALYTICS_PATHS.live);
    const cutoff = Date.now() - ANALYTICS_LIMITS.presenceMaxAgeMs;
    let removed = 0;

    for (
      let batch = 0;
      batch < ANALYTICS_LIMITS.cleanupMaxBatches;
      batch += 1
    ) {
      const snapshot = await liveRef
        .orderByChild("lastSeenAt")
        .endAt(cutoff)
        .limitToFirst(ANALYTICS_LIMITS.cleanupBatchSize)
        .get();

      if (!snapshot.exists()) {
        break;
      }

      const removals: Record<string, null> = {};

      snapshot.forEach(child => {
        const lastSeenAt = child.child("lastSeenAt").val();

        if (typeof lastSeenAt !== "number" || lastSeenAt <= cutoff) {
          removals[child.key as string] = null;
        }
      });

      const keys = Object.keys(removals);
      if (!keys.length) {
        break;
      }

      await liveRef.update(removals);
      removed += keys.length;

      if (keys.length < ANALYTICS_LIMITS.cleanupBatchSize) {
        break;
      }
    }

    if (removed > 0) {
      logger.info("Removed stale analytics presence records.", { count: removed });
    }
  },
);

async function updateOnlineCount(delta: 1 | -1): Promise<void> {
  const countRef = getDatabase().ref(ANALYTICS_PATHS.onlineCount);

  await countRef.transaction(currentValue => {
    const currentCount = typeof currentValue === "number" && Number.isFinite(currentValue)
      ? Math.max(0, Math.trunc(currentValue))
      : 0;

    return Math.max(0, currentCount + delta);
  });
}

