import { NextResponse } from "next/server";

import { exportAllData } from "@/lib/export";
import { TIME_ZONE } from "@/lib/time";

import { requireAdmin } from "../require-admin";

export const dynamic = "force-dynamic";

/** Downloads every table of school data as one dated JSON file. Admins only. */
export async function GET(): Promise<NextResponse> {
  await requireAdmin();
  const file = await exportAllData();
  const date = new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
  return new NextResponse(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pocketclerk-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
