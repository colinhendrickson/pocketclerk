import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request carries `Authorization: Bearer <secret>`. Constant-time, so
 * response timing does not reveal how much of a guess matched.
 */
export function hasBearer(request: Request, secret: string): boolean {
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}
