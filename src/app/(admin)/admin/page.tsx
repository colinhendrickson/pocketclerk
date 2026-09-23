import Link from "next/link";

import { getDashboardStats } from "@/lib/admin-queries";
import { branding } from "@/lib/branding";
import { formatUSD } from "@/lib/money";
import { startOfLocalDay, today } from "@/lib/time";

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

  const stats = await getDashboardStats(since);

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <h1 className="text-2xl font-extrabold">Hello, {admin.name}</h1>

      <div className="stats stats-vertical border border-base-300 bg-base-100 lg:stats-horizontal">
        <div className="stat">
          <span className="stat-title">Orders today</span>
          <span className="stat-value tabular">{stats.ordersToday}</span>
        </div>
        <div className="stat">
          <span className="stat-title">Sales today</span>
          <span className="stat-value tabular">
            {formatUSD(stats.salesTodayCents)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-title">Shifts open now</span>
          <span className="stat-value tabular">{stats.openShifts}</span>
        </div>
        <div className="stat">
          <span className="stat-title">Receipts failed</span>
          <span className="stat-value tabular">
            {stats.failedReceipts}
          </span>
        </div>
      </div>

      {stats.failedReceipts > 0 ? (
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
