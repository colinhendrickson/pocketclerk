import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js. Earlier files take precedence.
loadEnv({ path: [".env.local", ".env"] });

// Migrations need a direct (non-pooled) connection, so direct URLs are preferred.
// POSTGRES_URL_NON_POOLING is the Vercel Supabase integration's name for it.
// See docs/adr/0008-session-pooler-and-idle-connections.md.
const url =
  process.env.DIRECT_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

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
