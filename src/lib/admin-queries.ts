import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  addons,
  inventoryItems,
  menuItems,
  orderItemAddons,
  orderItems,
  orders,
  persons,
  shifts,
  students,
  teacherProfiles,
} from "@/db/schema";
import { isMenuIconKey, type MenuIconKey } from "@/lib/menu-icons";

/**
 * Read helpers for the admin screens. Unlike the cart's `queries.ts`, these
 * include deactivated rows. Totals are aggregated in Postgres, not in JS.
 */

/* -------------------------------------------------------------------------- */
/* Students                                                                   */
/* -------------------------------------------------------------------------- */

export interface StudentRow {
  id: string;
  displayName: string;
  active: boolean;
  shiftCount: number;
  /** Lifetime hours, in hundredths. Formatted with `formatHours` at the edge. */
  hoursHundredths: number;
  rewardTickets: number;
}

/**
 * Every student with lifetime totals. LEFT JOIN keeps students with no shifts;
 * open shifts have null hours/tickets and contribute nothing until closed.
 */
export async function listStudentsWithTotals(): Promise<StudentRow[]> {
  return db
    .select({
      id: students.id,
      displayName: students.displayName,
      active: students.active,
      shiftCount: sql<number>`count(${shifts.id})::int`,
      hoursHundredths: sql<number>`coalesce(sum(${shifts.hoursHundredths}), 0)::int`,
      rewardTickets: sql<number>`coalesce(sum(${shifts.rewardTickets}), 0)::int`,
    })
    .from(students)
    .leftJoin(shifts, eq(shifts.studentId, students.id))
    .groupBy(students.id, students.displayName, students.active)
    .orderBy(asc(students.displayName));
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface DashboardStats {
  ordersToday: number;
  salesTodayCents: number;
  /** Cash and card parts of `salesTodayCents`; only the cash part is in the drawer. */
  cashSalesTodayCents: number;
  cardSalesTodayCents: number;
  openShifts: number;
  failedReceipts: number;
}

/**
 * Stats for the admin landing page.
 *
 * `since` is passed as an ISO string with an explicit cast, never a `Date`:
 * Drizzle's postgres.js adapter replaces the timestamp serializer with a
 * pass-through, and raw `sql` templates have no column mapper to convert Dates.
 */
export async function getDashboardStats(since: Date): Promise<DashboardStats> {
  const from = since.toISOString();
  const [row] = await db.execute<{
    orders_today: number;
    sales_today: number;
    cash_today: number;
    card_today: number;
    open_shifts: number;
    failed_receipts: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM orders WHERE created_at >= ${from}::timestamptz) AS orders_today,
      (SELECT coalesce(sum(total_cents), 0)::int FROM orders WHERE created_at >= ${from}::timestamptz) AS sales_today,
      (SELECT coalesce(sum(total_cents), 0)::int FROM orders
        WHERE created_at >= ${from}::timestamptz AND payment_method = 'cash') AS cash_today,
      (SELECT coalesce(sum(total_cents), 0)::int FROM orders
        WHERE created_at >= ${from}::timestamptz AND payment_method = 'card') AS card_today,
      (SELECT count(*)::int FROM shifts WHERE clock_out IS NULL) AS open_shifts,
      (SELECT count(*)::int FROM receipt_jobs WHERE status = 'failed') AS failed_receipts
  `);
  return {
    ordersToday: row?.orders_today ?? 0,
    salesTodayCents: row?.sales_today ?? 0,
    cashSalesTodayCents: row?.cash_today ?? 0,
    cardSalesTodayCents: row?.card_today ?? 0,
    openShifts: row?.open_shifts ?? 0,
    failedReceipts: row?.failed_receipts ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export interface SalesTotals {
  orderCount: number;
  totalCents: number;
  cashCents: number;
  cardCents: number;
}

/**
 * Sales in `[from, to)`, split by how they were paid. Dates go in as ISO
 * strings for the reason given on `getDashboardStats`.
 */
export async function getSalesBetween(from: Date, to: Date): Promise<SalesTotals> {
  const [row] = await db.execute<{
    order_count: number;
    total: number;
    cash: number;
    card: number;
  }>(sql`
    SELECT
      count(*)::int AS order_count,
      coalesce(sum(total_cents), 0)::int AS total,
      coalesce(sum(total_cents) FILTER (WHERE payment_method = 'cash'), 0)::int AS cash,
      coalesce(sum(total_cents) FILTER (WHERE payment_method = 'card'), 0)::int AS card
    FROM orders
    WHERE created_at >= ${from.toISOString()}::timestamptz
      AND created_at < ${to.toISOString()}::timestamptz
  `);
  return {
    orderCount: row?.order_count ?? 0,
    totalCents: row?.total ?? 0,
    cashCents: row?.cash ?? 0,
    cardCents: row?.card ?? 0,
  };
}

export interface AdminOrderRow {
  id: string;
  teacherId: string;
  totalCents: number;
  paymentMethod: "cash" | "card";
  /** Null for card orders, which take no cash. */
  receivedCents: number | null;
  changeCents: number | null;
  createdAt: Date;
  teacherName: string;
  room: string | null;
  studentName: string;
  items: string | null;
  extras: string | null;
}

/**
 * Orders in `[from, to)`, newest first. Line items come from the snapshot
 * columns, so this shows what was charged rather than current menu prices.
 */
export async function listOrdersBetween(from: Date, to: Date): Promise<AdminOrderRow[]> {
  return db
    .select({
      id: orders.id,
      teacherId: orders.teacherId,
      totalCents: orders.totalCents,
      paymentMethod: orders.paymentMethod,
      receivedCents: orders.receivedCents,
      changeCents: orders.changeCents,
      createdAt: orders.createdAt,
      teacherName: persons.name,
      room: teacherProfiles.room,
      studentName: students.displayName,
      items: sql<string | null>`(
        SELECT string_agg(oi.qty || ' x ' || oi.name_snapshot, ', ' ORDER BY oi.id)
        FROM ${orderItems} oi WHERE oi.order_id = ${orders.id}
      )`,
      extras: sql<string | null>`(
        SELECT string_agg(DISTINCT oa.name_snapshot, ', ')
        FROM ${orderItemAddons} oa
        JOIN ${orderItems} oi2 ON oi2.id = oa.order_item_id
        WHERE oi2.order_id = ${orders.id}
      )`,
    })
    .from(orders)
    .innerJoin(teacherProfiles, eq(teacherProfiles.personId, orders.teacherId))
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .innerJoin(shifts, eq(shifts.id, orders.shiftId))
    .innerJoin(students, eq(students.id, shifts.studentId))
    .where(and(gte(orders.createdAt, from), lt(orders.createdAt, to)))
    .orderBy(desc(orders.createdAt));
}

/* -------------------------------------------------------------------------- */
/* Teachers                                                                   */
/* -------------------------------------------------------------------------- */

export interface TeacherOrderRow {
  id: string;
  teacherId: string;
  totalCents: number;
  createdAt: Date;
}

export interface TeacherRow {
  id: string;
  name: string;
  room: string | null;
  email: string | null;
  active: boolean;
  /** Usually pays with a staff card; the cart reminds students to ask for it. */
  prefersCard: boolean;
  notes: string[];
  orderCount: number;
  totalSpentCents: number;
  /** Newest first, capped at ten. See `listTeachersWithTotals`. */
  recentOrders: TeacherOrderRow[];
}

const RECENT_ORDERS_PER_TEACHER = 10;

/**
 * Every teacher with notes, order count, lifetime spend, and recent orders.
 * Recent orders for all teachers come from one windowed query; the set is small
 * enough that eager loading beats fetching per row on expand.
 */
export async function listTeachersWithTotals(): Promise<TeacherRow[]> {
  const profiles = await db
    .select({
      id: teacherProfiles.personId,
      name: persons.name,
      room: teacherProfiles.room,
      email: persons.email,
      active: teacherProfiles.active,
      prefersCard: teacherProfiles.prefersCard,
      notes: teacherProfiles.notes,
      orderCount: sql<number>`count(${orders.id})::int`,
      totalSpentCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(teacherProfiles)
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .leftJoin(orders, eq(orders.teacherId, teacherProfiles.personId))
    .groupBy(
      teacherProfiles.personId,
      persons.name,
      teacherProfiles.room,
      persons.email,
      teacherProfiles.active,
      teacherProfiles.prefersCard,
      teacherProfiles.notes,
    )
    .orderBy(asc(persons.name));

  const recent = await db.execute<{
    id: string;
    teacher_id: string;
    total_cents: number;
    created_at: Date;
  }>(sql`
    SELECT id, teacher_id, total_cents, created_at
    FROM (
      SELECT
        o.id,
        o.teacher_id,
        o.total_cents,
        o.created_at,
        row_number() OVER (
          PARTITION BY o.teacher_id ORDER BY o.created_at DESC, o.id DESC
        ) AS rn
      FROM orders o
    ) ranked
    WHERE rn <= ${RECENT_ORDERS_PER_TEACHER}
    ORDER BY teacher_id, created_at DESC
  `);

  const byTeacher = new Map<string, TeacherOrderRow[]>();
  for (const row of recent) {
    const list = byTeacher.get(row.teacher_id) ?? [];
    list.push({
      id: row.id,
      teacherId: row.teacher_id,
      totalCents: row.total_cents,
      // Raw SQL results are untyped; normalize to a Date.
      createdAt: new Date(row.created_at),
    });
    byTeacher.set(row.teacher_id, list);
  }

  return profiles.map((profile) => ({
    ...profile,
    recentOrders: byTeacher.get(profile.id) ?? [],
  }));
}

/* -------------------------------------------------------------------------- */
/* Menu                                                                       */
/* -------------------------------------------------------------------------- */

export interface MenuItemRow {
  id: string;
  name: string;
  priceCents: number;
  isSpecial: boolean;
  icon: MenuIconKey | null;
  active: boolean;
}

export interface AddonRow {
  id: string;
  name: string;
  priceCents: number;
  icon: MenuIconKey | null;
  active: boolean;
}

/**
 * Menu items including deactivated rows, in cart order (`sort_order`, then
 * name) so inactive items stay in place rather than sinking to the bottom.
 */
export async function listMenuForAdmin(): Promise<MenuItemRow[]> {
  return db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      priceCents: menuItems.priceCents,
      isSpecial: menuItems.isSpecial,
      icon: menuItems.icon,
      active: menuItems.active,
    })
    .from(menuItems)
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name))
    .then((rows) => rows.map((row) => ({ ...row, icon: asIcon(row.icon) })));
}

export async function listAddonsForAdmin(): Promise<AddonRow[]> {
  return db
    .select({
      id: addons.id,
      name: addons.name,
      priceCents: addons.priceCents,
      icon: addons.icon,
      active: addons.active,
    })
    .from(addons)
    .orderBy(asc(addons.sortOrder), asc(addons.name))
    .then((rows) => rows.map((row) => ({ ...row, icon: asIcon(row.icon) })));
}

/** The column is text; the CHECK constraint keeps it to the set. */
function asIcon(value: string | null): MenuIconKey | null {
  return isMenuIconKey(value) ? value : null;
}

export interface SupplyRow {
  id: string;
  name: string;
  unit: string;
  parLevel: number;
  active: boolean;
}

/** Every supply, including ones taken off, for the Inventory page. */
export async function listSuppliesForAdmin(): Promise<SupplyRow[]> {
  return db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      unit: inventoryItems.unit,
      parLevel: inventoryItems.parLevel,
      active: inventoryItems.active,
    })
    .from(inventoryItems)
    .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.name));
}
