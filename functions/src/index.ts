import { initializeApp } from "firebase-admin/app";

initializeApp();

export { registerVisit } from "./analytics/register-visit";
export {
  cleanupStalePresence,
  decrementOnlineCount,
  incrementOnlineCount,
} from "./analytics/presence";

