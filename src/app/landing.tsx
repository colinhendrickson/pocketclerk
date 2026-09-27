import Image from "next/image";
import Link from "next/link";

import { Logo } from "@/components";
import { enterDemoAdmin } from "@/app/demo/actions";
import { PRODUCT_NAME } from "@/lib/site-mode";

/**
 * pocket-clerk.com: what PocketClerk is, and two ways into the demo.
 *
 * Shown only in demo mode; on a school's copy `/` goes straight to the cart.
 * The demo banner above it comes from the root layout. One primary button, as
 * everywhere: Try the cart. The admin entry is a form, so it works before the
 * page hydrates.
 */

const REPO = "https://github.com/colinhendrickson/pocketclerk";

const IDEAS = [
  {
    title: "Built for students with disabilities",
    body: "Big buttons, one question per screen, no typing, and a PIN instead of a password. Every screen was designed for the students who run the cart.",
  },
  {
    title: "Change on every sale",
    body: "Students count the money handed over, and the app shows the change in the largest numbers on screen, with the bills to give back.",
  },
  {
    title: "A $30 receipt printer",
    body: "Receipts print over Bluetooth to a small thermal printer, and teachers can get one by email instead.",
  },
  {
    title: "Accessible, and checked",
    body: "Built to WCAG 2.2 AA, with automated accessibility checks on every screen at phone, tablet and desktop sizes.",
  },
];

const SHOTS = [
  { src: "/landing/order-builder.png", width: 1180, height: 820, alt: "A student building a teacher's order: a menu of drinks, add-ons, and a running total." },
  { src: "/landing/make-change.png", width: 1180, height: 820, alt: "The change screen: $5.00 handed over for $2.00, and $3.00 to give back in large numbers." },
  { src: "/landing/admin-home.png", width: 1440, height: 900, alt: "The admin home, with a setup checklist and a guide to every page." },
];

export function Landing() {
  return (
    <main className="flex-1 bg-base-200">
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-12 text-center md:py-16">
        <Logo size={72} />
        <h1 className="text-[44px] font-extrabold leading-tight md:text-[48px]">
          A coffee cart, run by students
        </h1>
        <p className="max-w-2xl text-[20px] font-bold opacity-80">
          {PRODUCT_NAME} is a point of sale and work-training app for student-run carts in special
          education programs. Students take orders, make change and clock their hours; staff see
          it all in one place.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/cart" className="btn btn-primary min-h-[60px] px-8 text-[22px] font-extrabold">
            Try the cart
          </Link>
          <form action={enterDemoAdmin}>
            <button
              type="submit"
              className="btn min-h-[60px] border-base-300 bg-base-100 px-8 text-[22px] font-extrabold"
            >
              Look around as an admin
            </button>
          </form>
        </div>
        <p className="text-[18px] font-bold opacity-80">Every student&apos;s PIN is 1234.</p>
      </section>

      <section aria-labelledby="ideas" className="mx-auto max-w-5xl px-4 pb-12">
        <h2 id="ideas" className="mb-6 text-[26px] font-extrabold">
          Who it is for
        </h2>
        <p className="mb-8 max-w-3xl text-[18px] font-bold opacity-80">
          Teachers and job coaches who run a cart, a coffee service or a school store as work
          training. Each school gets its own copy, with its own students, menu and colors.
        </p>
        <ul className="grid gap-4 md:grid-cols-2">
          {IDEAS.map((idea) => (
            <li key={idea.title} className="rounded-box border border-base-300 bg-base-100 p-6">
              <h3 className="mb-2 text-[22px] font-extrabold">{idea.title}</h3>
              <p className="text-[18px] font-bold opacity-80">{idea.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="screens" className="mx-auto max-w-5xl px-4 pb-12">
        <h2 id="screens" className="mb-6 text-[26px] font-extrabold">
          What it looks like
        </h2>
        <ul className="grid gap-6">
          {SHOTS.map((shot) => (
            <li key={shot.src}>
              <Image
                src={shot.src}
                width={shot.width}
                height={shot.height}
                alt={shot.alt}
                className="h-auto w-full rounded-box border border-base-300"
                sizes="(min-width: 1024px) 1024px, 100vw"
              />
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-base-300 bg-base-100">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-[18px] font-bold sm:flex-row sm:gap-6">
          <a className="link" href={REPO}>
            Source code on GitHub
          </a>
          <a className="link" href={`${REPO}/blob/main/docs/DEPLOYMENT.md`}>
            Run a copy for your school
          </a>
          <span className="opacity-80">Open source, MIT license.</span>
        </div>
      </footer>
    </main>
  );
}
