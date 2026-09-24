import Link from "next/link";

import { getDashboardStats } from "@/lib/admin-queries";
import { branding } from "@/lib/branding";
import { pairingUrl } from "@/lib/device";
import { GLOSSARY, GUIDES, TOPICS } from "@/lib/help";
import { formatUSD } from "@/lib/money";
import { getSetupCounts, setupChecklist } from "@/lib/setup";
import { startOfLocalDay, today } from "@/lib/time";

import { GuideSearch } from "./_help/guide-search";
import { requireAdmin } from "./require-admin";
import { SetupChecklist } from "./setup-checklist";

export const dynamic = "force-dynamic";

/**
 * Admin landing page: what the cart still needs, what needs attention, what
 * happened today, and how to do anything.
 *
 * Deliberately not a wall of charts. Staff open this a few times a term, so it
 * answers their questions in order: is the cart ready, is anything wrong, how
 * did today go, and how do I…. The last is every guide, searchable, so a
 * question never has to go to whoever built this.
 */
export default async function AdminHomePage() {
  const admin = await requireAdmin();

  // "Today" at the cart. The database's current_date is UTC, which rolls over
  // at 8 PM there, so an evening look at the dashboard read zero sales.
  const since = startOfLocalDay(today());

  const [stats, counts] = await Promise.all([getDashboardStats(since), getSetupCounts()]);
  const steps = setupChecklist(counts);

  const cards = [
    { href: "/admin/students", title: "Students", body: "PINs, hours and who can sign in at the cart." },
    { href: "/admin/teachers", title: "Teachers", body: "Emails for receipts, and notes students see." },
    { href: "/admin/menu", title: "Menu", body: "Items, prices, the special and add-ons." },
    { href: "/admin/orders", title: "Orders", body: "Every sale, one day at a time." },
    { href: "/admin/receipts", title: "Receipts", body: "Whether each teacher's receipt arrived." },
    { href: "/admin/admins", title: "Admins", body: "Which staff can use this admin side." },
    { href: "/admin/colors", title: "Colors", body: "Set buttons and highlights to the school's colour." },
  ];

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-8 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">Hello, {admin.name}</h1>
        <p className="max-w-prose opacity-75">
          This is where staff look after {branding.cartName}. Everything you might need to
          do is explained in the guides at the bottom of this page.
        </p>
      </header>

      <SetupChecklist
        steps={steps}
        pairingUrl={pairingUrl(process.env.NEXT_PUBLIC_APP_URL ?? "")}
        adminEmail={admin.email}
      />

      {stats.failedReceipts > 0 ? (
        <section aria-labelledby="attention-heading" className="flex flex-col gap-2">
          <h2 id="attention-heading" className="text-xl font-extrabold">
            Needs attention
          </h2>
          <Link href="/admin/receipts" className="alert alert-warning rounded-box">
            {stats.failedReceipts === 1 ? "A receipt" : `${stats.failedReceipts} receipts`}{" "}
            could not be delivered. Open Receipts to see why and send again.
          </Link>
        </section>
      ) : null}

      <section data-tour="today" aria-labelledby="today-heading" className="flex flex-col gap-2">
        <h2 id="today-heading" className="text-xl font-extrabold">
          Today
        </h2>
        <div className="stats stats-vertical border border-base-300 bg-base-100 lg:stats-horizontal">
          <div className="stat">
            <span className="stat-title">Orders today</span>
            <span className="stat-value tabular">{stats.ordersToday}</span>
          </div>
          <div className="stat">
            <span className="stat-title">Sales today</span>
            <span className="stat-value tabular">{formatUSD(stats.salesTodayCents)}</span>
          </div>
          <div className="stat">
            <span className="stat-title">Shifts open now</span>
            <span className="stat-value tabular">{stats.openShifts}</span>
          </div>
          <div className="stat">
            <span className="stat-title">Receipts failed</span>
            <span className="stat-value tabular">{stats.failedReceipts}</span>
          </div>
        </div>
      </section>

      <nav aria-labelledby="pages-heading" className="flex flex-col gap-2">
        <h2 id="pages-heading" className="text-xl font-extrabold">
          Pages
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.href}>
              <Link
                href={card.href}
                className="card card-border h-full bg-base-100 p-5 hover:border-primary"
              >
                <span className="text-lg font-extrabold">{card.title}</span>
                <span className="opacity-75">{card.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section id="guides" data-tour="guides" aria-labelledby="guides-heading" className="flex flex-col gap-3">
        <h2 id="guides-heading" className="text-xl font-extrabold">
          How do I…
        </h2>
        <p className="max-w-prose opacity-75">
          Step-by-step answers for everything on the admin side. Search for a word, or open a
          topic below.
        </p>
        <GuideSearch topics={TOPICS} guides={GUIDES} />
      </section>

      <section aria-labelledby="glossary-heading" className="flex flex-col gap-3">
        <h2 id="glossary-heading" className="text-xl font-extrabold">
          What the words mean
        </h2>
        <dl className="grid gap-3 md:grid-cols-2">
          {GLOSSARY.map((entry) => (
            <div key={entry.term} className="rounded-box border border-base-300 bg-base-100 p-4">
              <dt className="font-extrabold">{entry.term}</dt>
              <dd className="opacity-75">{entry.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
