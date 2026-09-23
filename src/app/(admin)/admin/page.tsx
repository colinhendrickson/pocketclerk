import Link from "next/link";

import { db } from "@/db";
import { branding } from "@/lib/branding";
import { formatUSD } from "@/lib/money";
import { startOfLocalDay, today } from "@/lib/time";
import { sql } from "drizzle-orm";

import { requireAdmin } from "./require-admin";

export const dynamic = "force-dynamic";

/**
 * Admin landing page: what happened today, and what needs attention.
 *
 * Deliberately not a wall of charts. The one question the administrator has
 * when she opens this is whether the cart ran properly, so failed receipts and
 * open shifts come first.
 */
export default async function AdminHomePage() {
  const admin = await requireAdmin();

  // "Today" at the cart. The database's current_date is UTC, which rolls over
  // at 8 PM there, so an evening look at the dashboard read zero sales.
  const since = startOfLocalDay(today());

  const [stats] = await db.execute<{
    orders_today: number;
    sales_today: number;
    open_shifts: number;
    failed_receipts: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM orders WHERE created_at >= ${since}) AS orders_today,
      (SELECT coalesce(sum(total_cents), 0)::int FROM orders WHERE created_at >= ${since}) AS sales_today,
      (SELECT count(*)::int FROM shifts WHERE clock_out IS NULL) AS open_shifts,
      (SELECT count(*)::int FROM receipt_jobs WHERE status = 'failed') AS failed_receipts
  `);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-extrabold">Hello, {admin.name}</h1>

      <div className="stats stats-vertical border border-base-300 bg-base-100 lg:stats-horizontal">
        <div className="stat">
          <span className="stat-title">Orders today</span>
          <span className="stat-value tabular">{stats?.orders_today ?? 0}</span>
        </div>
        <div className="stat">
          <span className="stat-title">Sales today</span>
          <span className="stat-value tabular">
            {formatUSD(stats?.sales_today ?? 0)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-title">Shifts open now</span>
          <span className="stat-value tabular">{stats?.open_shifts ?? 0}</span>
        </div>
        <div className="stat">
          <span className="stat-title">Receipts failed</span>
          <span className="stat-value tabular">
            {stats?.failed_receipts ?? 0}
          </span>
        </div>
      </div>

      {(stats?.failed_receipts ?? 0) > 0 ? (
        <Link href="/admin/receipts" className="alert alert-warning rounded-box">
          Some receipts could not be delivered. Open the receipts page to see why
          and try again.
        </Link>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/admin/students", title: "Students", body: "Hours, rewards and PINs." },
          { href: "/admin/teachers", title: "Teachers", body: "Notes, emails and order history." },
          { href: "/admin/menu", title: "Menu", body: `Items, prices and ${branding.rewardName.toLowerCase()} settings.` },
          { href: "/admin/orders", title: "Orders", body: "Every sale, by day." },
          { href: "/admin/receipts", title: "Receipts", body: "Delivery status and retries." },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card card-border bg-base-100 p-5 hover:border-primary"
          >
            <h2 className="text-lg font-extrabold">{card.title}</h2>
            <p className="opacity-70">{card.body}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
