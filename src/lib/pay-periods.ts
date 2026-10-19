import { desc, sql } from "drizzle-orm";

import { db } from "@/db";
import { payPeriods } from "@/db/schema";
import { isUniqueViolation } from "@/lib/pg-errors";

/**
 * Pay periods (4.23). Staff press Start new pay period after paychecks go out;
 * from then on the roster's hours count from that moment. A shift belongs to
 * the period it was clocked out in, which is when its hours were credited, so
 * a shift is never split or counted twice. Nothing is reset or deleted: past
 * periods are computed from the same closed shifts as the lifetime totals.
 */

export interface CurrentPayPeriod {
  /** The period's row, or null before staff have ever started one. */
  id: string | null;
  /** When it started; null means "since the first shift". */
  startedAt: Date | null;
}

export async function getCurrentPayPeriod(): Promise<CurrentPayPeriod> {
  const [row] = await db
    .select({ id: payPeriods.id, startedAt: payPeriods.startedAt })
    .from(payPeriods)
    .orderBy(desc(payPeriods.startedAt))
    .limit(1);
  return row ? { id: row.id, startedAt: row.startedAt } : { id: null, startedAt: null };
}

export type StartPayPeriodResult = { ok: true } | { ok: false; error: "stale" };

/**
 * Starts a new period after the one the caller saw. If another period was
 * started since (a double click, a second staff member, a stale tab), the
 * unique indexes on `previous_id` refuse the insert and nothing changes.
 */
export async function startPayPeriod(input: {
  previousId: string | null;
  startedBy: string;
}): Promise<StartPayPeriodResult> {
  const current = await getCurrentPayPeriod();
  if (current.id !== input.previousId) return { ok: false, error: "stale" };

  try {
    await db.insert(payPeriods).values({
      previousId: input.previousId,
      startedBy: input.startedBy,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "stale" };
    throw error;
  }
  return { ok: true };
}

export interface PastPeriodStudent {
  studentId: string;
  displayName: string;
  shiftCount: number;
  hoursHundredths: number;
}

export interface PastPayPeriod {
  /** When the period started. The open-ended first period uses its first clock-out. */
  startedAt: Date;
  /** When the next period started, which ended this one. */
  endedAt: Date;
  students: PastPeriodStudent[];
}

/**
 * Every finished period, newest first, with each student's hours in it.
 * Students with no shifts in a period are left out of it. Timestamps are read
 * back as ISO strings and converted here: raw `sql` has no column mapper.
 */
export async function listPastPayPeriods(): Promise<PastPayPeriod[]> {
  const rows = await db.execute<{
    period_start: string | null;
    period_end: string;
    period_first_clock_out: string;
    student_id: string;
    display_name: string;
    shift_count: number;
    hours: number;
  }>(sql`
    WITH bounds AS (
      SELECT started_at AS starts,
             lead(started_at) OVER (ORDER BY started_at) AS ends
        FROM pay_periods
      UNION ALL
      -- Shifts from before the first period was started.
      SELECT NULL, min(started_at) FROM pay_periods HAVING count(*) > 0
    ),
    per_student AS (
      SELECT b.starts, b.ends, st.id AS student_id, st.display_name,
             count(sh.id)::int AS shift_count,
             coalesce(sum(sh.hours_hundredths), 0)::int AS hours,
             min(sh.clock_out) AS first_clock_out
        FROM bounds b
        JOIN shifts sh
          ON sh.clock_out < b.ends
         AND (b.starts IS NULL OR sh.clock_out >= b.starts)
        JOIN students st ON st.id = sh.student_id
       WHERE b.ends IS NOT NULL
       GROUP BY b.starts, b.ends, st.id, st.display_name
    )
    SELECT starts AS period_start, ends AS period_end,
           min(first_clock_out) OVER (PARTITION BY ends) AS period_first_clock_out,
           student_id, display_name, shift_count, hours
      FROM per_student
     ORDER BY ends DESC, display_name
  `);

  const periods = new Map<string, PastPayPeriod>();
  for (const row of rows) {
    // Keyed by instant: the driver may hand back a string or a Date.
    const key = new Date(row.period_end).toISOString();
    let period = periods.get(key);
    if (!period) {
      period = {
        startedAt: new Date(row.period_start ?? row.period_first_clock_out),
        endedAt: new Date(row.period_end),
        students: [],
      };
      periods.set(key, period);
    }
    period.students.push({
      studentId: row.student_id,
      displayName: row.display_name,
      shiftCount: row.shift_count,
      hoursHundredths: row.hours,
    });
  }
  return [...periods.values()];
}
