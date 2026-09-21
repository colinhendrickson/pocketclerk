import { config } from "dotenv";

/**
 * Loads `.env.local` for scripts that run outside Next.js, such as the seed.
 *
 * This lives in its own module because ES module imports are hoisted and
 * evaluated before any statement in the importing file. Calling `dotenv` at the
 * top of `seed.ts` would still run *after* `import { db } from "./index"` had
 * already read `process.env` and thrown. Importing this module first works
 * because imports evaluate in source order.
 */
config({ path: [".env.local", ".env"] });
