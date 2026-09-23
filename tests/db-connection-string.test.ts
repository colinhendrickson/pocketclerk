import { describe, expect, it } from "vitest";

import { sessionPoolerUrl } from "@/db";

describe("sessionPoolerUrl", () => {
  it("moves Supabase's transaction pooler to its session port", () => {
    expect(
      sessionPoolerUrl(
        "postgresql://postgres.abc:secret@aws-0-us-east-2.pooler.supabase.com:6543/postgres",
      ),
    ).toBe("postgresql://postgres.abc:secret@aws-0-us-east-2.pooler.supabase.com:5432/postgres");
  });

  it("keeps the query string, as the Vercel integration's URL carries one", () => {
    expect(
      sessionPoolerUrl(
        "postgres://postgres.abc:secret@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x",
      ),
    ).toBe(
      "postgres://postgres.abc:secret@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require&supa=base-pooler.x",
    );
  });

  it("leaves every other database alone", () => {
    for (const url of [
      "postgresql://pocketclerk:pocketclerk@localhost:54329/pocketclerk",
      "postgresql://postgres.abc:secret@aws-0-us-east-2.pooler.supabase.com:5432/postgres",
      "postgresql://postgres:secret@db.abc.supabase.co:5432/postgres",
      "postgresql://user:pw@localhost:6543/db",
    ]) {
      expect(sessionPoolerUrl(url)).toBe(url);
    }
  });
});
