import {
  boolean,
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
 * Conventions enforced across every table here:
 *
 * - uuid primary keys, so ids are safe to put in URLs and cannot be enumerated.
 * - timestamptz everywhere. The iPad, the server and the admin's phone are three
 *   clocks; a naive timestamp silently picks the wrong one.
 * - Integers for everything countable. Money is `*_cents`, hours are hundredths.
 *   No numeric or float columns exist in this schema by design.
 * - Nullable columns encode state. `shifts.clock_out IS NULL` *is* "on shift";
 *   a separate status column would drift out of sync with reality.
 * - Soft deletes via `active`. School records are never destroyed.
 * - Sold prices are snapshotted onto order rows, so editing the menu can never
 *   rewrite the history of what was actually charged.
 */

export const paymentMethod = pgEnum("payment_method", ["cash", "card"]);
export const receiptChannel = pgEnum("receipt_channel", ["print", "email"]);
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
 * One row per human customer or administrator. The program administrator is a
 * single person who is both: she buys coffee and she manages the cart. Modelling
 * that as one `persons` row with two optional profiles means revoking her admin
 * access never touches her order history.
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
    /**
     * Customer memory: "dairy issue, use non-dairy creamer". Surfaced above the
     * menu on every order so the UI enforces the lesson rather than relying on
     * the student to remember to look.
     */
    notes: text("notes").array().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("teacher_profiles_active_idx").on(t.active)],
);

/**
 * Allowlist. Presence of a row is what grants admin access; there is no role
 * column, because there is exactly one level of privilege and a boolean column
 * would only invite a second.
 */
export const adminUsers = pgTable("admin_users", {
  personId: uuid("person_id")
    .primaryKey()
    .references(() => persons.id, { onDelete: "restrict" }),
  addedBy: uuid("added_by").references(() => persons.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Single-use sign-in links.
 *
 * Only the hash is stored, for the same reason student PINs are hashed: a
 * leaked table must not be a set of working sign-in links. `usedAt` makes a
 * link single-use, and it is set in the same statement that redeems it so two
 * simultaneous clicks cannot both succeed.
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
     * The same sign-in, typed instead of clicked. The cart's iPad must never
     * have a personal mailbox signed into it, so the mail goes to a phone and
     * the code is typed on the iPad. Hashed like the token; guessing is bounded
     * by `attempts` rather than by the length of a six-digit secret.
     */
    codeHash: text("code_hash"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_login_tokens_person_idx").on(t.personId, t.createdAt)],
);

/**
 * Students deliberately have no auth identity. Accounts mean emails, passwords
 * and resets, which is friction this audience cannot absorb. A name tap plus a
 * hashed, rate-limited PIN is the whole identity model.
 */
export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    /** Hashed so a leaked table dump does not hand out every student's PIN. */
    pinHash: text("pin_hash").notNull(),
    /**
     * Rate limiting lives in the database, not in process memory. Serverless
     * functions do not share memory, so an in-memory counter would reset on
     * every cold start and stop limiting anything. A four-digit PIN cannot
     * survive brute force on its own; this is what actually stops guessing.
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
    /** NULL means the shift is open. This is the only "currently working" flag. */
    clockOut: timestamp("clock_out", { withTimezone: true }),
    /** 3.25 hours stored as 325. Integers only; see the note at the top. */
    hoursHundredths: integer("hours_hundredths"),
    /**
     * Named for the concept, not the deployment. Each program has its own name
     * for the reward; that label is white-label config, so the column is not.
     */
    rewardTickets: integer("reward_tickets"),
    /**
     * Keys of the end-of-shift tasks the student has ticked off. Stored as
     * completed keys rather than a row per task so that changing the checklist
     * never rewrites the history of shifts that used the old one.
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
    /** Often zero. A free add-on must not change the total. */
    priceCents: integer("price_cents").notNull().default(0),
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
     * V1 only ever writes "cash": the program's own specification is cash-only
     * and making change is the point of the exercise. The column and the two
     * nullable cash fields exist so a badge/card method can be added later
     * without a migration. See docs/adr/0005-cash-only-v1.md.
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

/**
 * `nameSnapshot` and `unitPriceCents` are copies, not lookups. Renaming a menu
 * item or changing its price must never alter what a past receipt says.
 */
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

/**
 * Supplies the cart consumes: cups, lids, napkins, the treat of the week.
 * Separate from `menu_items` because what is sold and what is stocked are
 * different lists; one cookie is a menu item and a napkin is not.
 */
export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** What one unit is, e.g. "cups". Shown next to the number. */
    unit: text("unit").notNull().default("items"),
    /** The level the cart should be restocked back up to. */
    parLevel: integer("par_level").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("inventory_items_active_idx").on(t.active, t.sortOrder)],
);

/**
 * One count per item per shift.
 *
 * `starting` is snapshotted when the count opens rather than derived on read,
 * because it is a claim about what was on the cart at that moment. Used is
 * `starting - remaining` and is deliberately not stored: a derived value that
 * is also stored is a value that can disagree with itself.
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
    /** Null until the student counts. */
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
 * Completing an order never blocks on a printer or an email. The order and its
 * receipt jobs commit in one transaction; delivery happens afterwards and
 * retries. The cart roams classrooms on school WiFi, so decoupling the sale
 * from the delivery is the cheapest reliability available.
 *
 * Print jobs are claimed by the tablet (the printer is attached to it over
 * Bluetooth); email jobs are claimed by the server. Both claim with an atomic
 * UPDATE ... RETURNING so two consumers cannot take the same row.
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
 * Settings an administrator changes from the admin side. One row, ever.
 *
 * `primary_color` is the deployment's main colour as `#rrggbb`, or null for
 * the committed theme's own. It lives here rather than in code or config so
 * that a school's colours never enter git (see CLAUDE.md, privacy) and staff
 * can change them without a developer. The single-row rule and the colour's
 * format are CHECK constraints in the migration, not only TypeScript.
 */
export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  primaryColor: text("primary_color"),
  updatedBy: uuid("updated_by").references(() => persons.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
