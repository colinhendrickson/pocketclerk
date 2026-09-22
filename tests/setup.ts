import { config } from "dotenv";

/**
 * Loads .env.local before any test module imports the database client.
 * Vitest runs outside Next.js, which is the only thing that reads .env.local
 * automatically.
 */
config({ path: [".env.local", ".env"] });
