/**
 * The demo's own database, beside the main one: same server and credentials,
 * database `pocketclerk_demo`. The demo spec wipes and reseeds it freely, so it
 * must never be the database the other specs use.
 */
export const DEMO_DATABASE = "pocketclerk_demo";

export function demoDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${DEMO_DATABASE}`;
  return parsed.toString();
}
