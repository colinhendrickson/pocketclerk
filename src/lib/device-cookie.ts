/** The pairing cookie's name and settings, shared by pairing and its renewal in src/proxy.ts. */
export const DEVICE_COOKIE = {
  name: "pocketclerk_device",
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    /** One school year, renewed on every student page (src/proxy.ts). */
    maxAge: 60 * 60 * 24 * 365,
  },
};
