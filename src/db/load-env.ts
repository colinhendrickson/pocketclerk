import { config } from "dotenv";

/**
 * Loads `.env.local` for scripts run outside Next.js. A separate module because
 * imports are hoisted: importing it first is the only way to populate
 * `process.env` before `./index` reads it.
 */
config({ path: [".env.local", ".env"] });
