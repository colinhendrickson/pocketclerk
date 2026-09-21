import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js reads .env.local automatically; drizzle-kit runs outside Next, so it
// has to be told. Later files do not override earlier ones, so .env.local wins.
loadEnv({ path: [".env.local", ".env"] });

// DIRECT_URL, not DATABASE_URL: migrations need session-level features that a
// transaction pooler strips. See docs/adr/0003-two-connection-strings.md.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("DIRECT_URL (or DATABASE_URL) must be set. Copy .env.example to .env.local.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
