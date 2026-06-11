import app from "./app.js";
import { pingDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { runExpiryJob } from "./services/creditPointsExpiry.js";
import { runSchemaMigrations } from "./services/schemaMigrations.js";
import { detectAbandonedCarts } from "./services/analyticsPipeline.js";
import { expireAbandonedCheckouts } from "./services/abandonedCheckoutService.js";

const EXPIRY_INTERVAL_MS = 24 * 60 * 60 * 1000; // run daily
const ABANDONED_CART_INTERVAL_MS = 5 * 60 * 1000;

async function runExpiry() {
  try {
    const result = await runExpiryJob();
    if (result.processed > 0) {
      console.log(`[CreditExpiry] ${new Date().toISOString()} — ${result.processed} customer(s), ${result.pointsExpired} pts expired`);
    }
    if (result.errors.length) {
      console.warn(`[CreditExpiry] ${result.errors.length} error(s):`, result.errors);
    }
  } catch (err) {
    console.error("[CreditExpiry] Job failed:", err.message);
  }
}

async function runAbandonedCartDetection() {
  try {
    await expireAbandonedCheckouts();
    await detectAbandonedCarts({
      windowMinutes: Number(process.env.ABANDONED_CART_WINDOW_MINUTES || 45)
    });
  } catch (error) {
    console.error("[Analytics] Abandoned cart detection failed:", error.message);
  }
}

async function startServer() {
  try {
    await pingDatabase();
    await runSchemaMigrations();
    console.log("MySQL connection established");
  } catch (error) {
    console.warn(`MySQL connection not ready: ${error.message}`);
  }

  app.listen(env.port, () => {
    console.log(`Avyona backend listening on http://localhost:${env.port}`);
  });

  // Run once 15 s after startup, then every 24 hours
  setTimeout(runExpiry, 15_000);
  setInterval(runExpiry, EXPIRY_INTERVAL_MS);
  setTimeout(runAbandonedCartDetection, 30_000);
  setInterval(runAbandonedCartDetection, ABANDONED_CART_INTERVAL_MS);
}

startServer();
