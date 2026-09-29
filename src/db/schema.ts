import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema conventions:
 * - uuid primary keys (safe in URLs, not enumerable); timestamptz everywhere.
 * - Money is integer `*_cents`, hours are integer hundredths. No numeric or
 *   float columns. See docs/adr/0001-money-as-integer-cents.md.
 * - Nullable columns encode state: `shifts.clock_out IS NULL` means on shift.
 * - Soft delete via `active`; school records are never hard-deleted.
 * - Sold names and prices are snapshotted onto order rows.
 */

export const paymentMethod = pgEnum("payment_method", ["cash", "card"]);
export const receiptChannel = pgEnum("receipt_channel", ["print", "email"]);
/** What the cart spends on. Mirrored by EXPENSE_CATEGORIES in src/lib/validate.ts. */
export const expenseCategory = pgEnum("expense_category", [
  "product",
  "supplies",
  "equipment",
  "treat",
  "other",
]);
export const receiptStatus = pgEnum("receipt_status", [
  "queued",
  "processing",
  "sent",
  "failed",
]);

/* -------------------------------------------------------------------------- */
/* People                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One row per human. Teacher and admin are optional profiles on the same
 * person, so revoking admin access never touches order history.
 */
export const persons = pgTable("persons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teacherProfiles = pgTable(
  "teacher_profiles",
  {
    personId: uuid("person_id")
      .primaryKey()
      .references(() => persons.id, { onDelete: "restrict" }),
    room: text("room"),
    /** Customer notes (e.g. dietary needs), shown above the menu on every order. */
    notes: text("notes").array().notNull().default([]),
    /** Usually pays with a staff card; the cart points this out at payment (3.7). */
    prefersCard: boolean("prefers_card").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("teacher_profiles_active_idx").on(t.active)],
);

/** Admin allowlist: a row's presence grants admin access. There is one privilege level. */
export const adminUsers = pgTable("admin_users", {
  personId: uuid("person_id")
    .primaryKey()
    .references(() => persons.id, { onDelete: "restrict" }),
  addedBy: uuid("added_by").references(() => persons.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /**
   * The one admin who gives and removes access, and who cannot be removed.
   * A partial unique index (migration 0015) allows at most one.
   */
  isOwner: boolean("is_owner").notNull().default(false),
});

/**
 * Single-use sign-in links. Only hashes are stored. `usedAt` is set in the same
 * statement that redeems the link, so concurrent redemptions cannot both succeed.
 * See docs/adr/0007-self-hosted-sign-in-links.md.
 */
export const adminLoginTokens = pgTable(
  "admin_login_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    /**
     * Hashed six-digit code for signing in on a shared device without opening
     * the email there. Guessing is bounded by `attempts`.
     */
    codeHash: text("code_hash"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_login_tokens_person_idx").on(t.personId, t.createdAt)],
);

/** Students have no auth account: identity is a name tap plus a hashed, rate-limited PIN. */
export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    pinHash: text("pin_hash").notNull(),
    /**
     * PIN rate limiting is stored here because serverless instances share no
     * memory. A four-digit PIN relies on this lockout to resist brute force.
     */
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("students_active_idx").on(t.active)],
);

/* -------------------------------------------------------------------------- */
/* Shifts                                                                     */
/* -------------------------------------------------------------------------- */

export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    clockIn: timestamp("clock_in", { withTimezone: true }).notNull().defaultNow(),
    /**
     * NULL means the shift is open; the only "on shift" flag. A partial unique
     * index in the migration allows one open shift per student.
     */
    clockOut: timestamp("clock_out", { withTimezone: true }),
    /** 3.25 hours is stored as 325. */
    hoursHundredths: integer("hours_hundredths"),
    /**
     * Closed by the system because the student never clocked out, with no
     * hours credited. Shown to staff so they can follow up.
     */
    autoClosed: boolean("auto_closed").notNull().default(false),
    /** Generic name; the display label is white-label config. */
    rewardTickets: integer("reward_tickets"),
    /**
     * Keys of completed end-of-shift tasks, so later checklist changes do not
     * rewrite past shifts.
     */
    checklist: text("checklist").array().notNull().default([]),
  },
  (t) => [index("shifts_student_idx").on(t.studentId, t.clockIn)],
);

/* -------------------------------------------------------------------------- */
/* Menu                                                                       */
/* -------------------------------------------------------------------------- */

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    category: text("category").notNull().default("drink"),
    /** The rotating "special treat" the administrator can switch on or off. */
    isSpecial: boolean("is_special").notNull().default(false),
    /**
     * Optional picture for pre-readers. A key from src/lib/menu-icons.ts,
     * enforced by a CHECK constraint. See docs/adr/0015-menu-pictures.md.
     */
    icon: text("icon"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("menu_items_active_idx").on(t.active, t.sortOrder)],
);

export const addons = pgTable(
  "addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Often zero (free add-on). */
    priceCents: integer("price_cents").notNull().default(0),
    icon: text("icon"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("addons_active_idx").on(t.active, t.sortOrder)],
);

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "restrict" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teacherProfiles.personId, { onDelete: "restrict" }),
    totalCents: integer("total_cents").notNull(),
    /**
     * V1 writes only "cash"; the enum and nullable cash fields leave room for
     * card payments without a migration. A CHECK constraint ties the cash fields
     * to the method. See docs/adr/0005-cash-only-in-v1.md.
     */
    paymentMethod: paymentMethod("payment_method").notNull().default("cash"),
    receivedCents: integer("received_cents"),
    changeCents: integer("change_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_shift_idx").on(t.shiftId, t.createdAt),
    index("orders_teacher_idx").on(t.teacherId, t.createdAt),
  ],
);

/** `nameSnapshot` and `unitPriceCents` are copied at sale time so menu edits never change past receipts. */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id").references(() => menuItems.id, {
      onDelete: "set null",
    }),
    nameSnapshot: text("name_snapshot").notNull(),
    qty: integer("qty").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderItemAddons = pgTable(
  "order_item_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    addonId: uuid("addon_id").references(() => addons.id, { onDelete: "set null" }),
    nameSnapshot: text("name_snapshot").notNull(),
    priceCents: integer("price_cents").notNull(),
  },
  (t) => [index("order_item_addons_item_idx").on(t.orderItemId)],
);

/* -------------------------------------------------------------------------- */
/* Inventory                                                                  */
/* -------------------------------------------------------------------------- */

/** Stocked supplies (cups, lids, napkins). Separate from `menu_items`: what is stocked is not what is sold. */
export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Display unit, e.g. "cups". */
    unit: text("unit").notNull().default("items"),
    /** Restock target. */
    parLevel: integer("par_level").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("inventory_items_active_idx").on(t.active, t.sortOrder)],
);

/**
 * One count per item per shift. `starting` is snapshotted when the count opens.
 * Usage (`max(0, starting - remaining)`) is derived, never stored; a count above
 * starting means stock was added since the last count.
 */
export const inventoryCounts = pgTable(
  "inventory_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    starting: integer("starting").notNull(),
    /** Null until counted. */
    remaining: integer("remaining"),
    restocked: boolean("restocked").notNull().default(false),
    countedAt: timestamp("counted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("inventory_counts_shift_item_key").on(t.shiftId, t.itemId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Receipt delivery queue                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Receipt delivery queue. The order and its jobs commit in one transaction;
 * delivery happens asynchronously with retries, so a sale never blocks on a
 * printer or email. Print jobs are claimed by the tablet, email jobs by the
 * server, both via atomic UPDATE ... RETURNING so no row is claimed twice.
 * See docs/adr/0002-receipt-job-queue.md.
 */
export const receiptJobs = pgTable(
  "receipt_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    channel: receiptChannel("channel").notNull(),
    status: receiptStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("receipt_jobs_claim_idx").on(t.channel, t.status, t.createdAt),
    /** At most one job per order per channel: makes retries idempotent. */
    uniqueIndex("receipt_jobs_order_channel_key").on(t.orderId, t.channel),
  ],
);

/**
 * Admin-editable settings; exactly one row. `primary_color` is `#rrggbb` or
 * null for the theme default, stored here so real branding stays out of git.
 * The single-row rule and color format are CHECK constraints. See
 * docs/adr/0011-staff-chosen-main-color.md.
 */
export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  primaryColor: text("primary_color"),
  updatedBy: uuid("updated_by").references(() => persons.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // Demo features require both this flag and the deployment's mode
  // (src/lib/demo.ts), so neither alone can turn a real deployment into the demo.
  isDemo: boolean("is_demo").notNull().default(false),
  // Last demo data reset; drives the hourly reset.
  demoResetAt: timestamp("demo_reset_at", { withTimezone: true }),
  /** Whether teachers may pay with a staff card instead of cash (3.7). Off until staff turn it on. */
  cardPaymentsEnabled: boolean("card_payments_enabled").notNull().default(false),
});

/* -------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type Person = typeof persons.$inferSelect;
export type TeacherProfile = typeof teacherProfiles.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Addon = typeof addons.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type ReceiptJob = typeof receiptJobs.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryCount = typeof inventoryCounts.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;

/**
 * What the cart spends: startup equipment and ongoing product. Logged by staff
 * so the ledger can show sales against costs. Entries are taken off with
 * `active = false`, never deleted; `amount_cents > 0` is a CHECK in the
 * migration.
 */
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The calendar day of the purchase, as staff wrote it. */
    spentOn: date("spent_on", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    category: expenseCategory("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    /** The admin who logged it. */
    createdBy: uuid("created_by")
      .notNull()
      .references(() => persons.id, { onDelete: "restrict" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("expenses_active_idx").on(t.active, t.spentOn)],
);
