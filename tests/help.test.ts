import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_ROUTES,
  GLOSSARY,
  GUIDES,
  PAGE_HELP,
  SETUP_STEP_TEXT,
  TOPICS,
  guideById,
} from "@/lib/help";
import { TOURS } from "@/lib/help/tours";

/**
 * The help is checked against the app, not just against itself.
 *
 * Help that sends someone to a page that was renamed, or names a guide that no
 * longer exists, is worse than no help: it is the thing staff were told to
 * trust. These fail the build when the two drift apart.
 */

const ADMIN_DIR = join(process.cwd(), "src", "app", "(admin)", "admin");

function pageFile(route: string) {
  return join(ADMIN_DIR, route.replace(/^\/admin\/?/, ""), "page.tsx");
}

describe("admin pages and their help", () => {
  it("lists every admin page, and every listed page exists", () => {
    const signedOut = new Set(["sign-in", "verify"]);
    const onDisk = readdirSync(ADMIN_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !signedOut.has(entry.name))
      .filter((entry) => existsSync(join(ADMIN_DIR, entry.name, "page.tsx")))
      .map((entry) => `/admin/${entry.name}`);

    expect([...ADMIN_ROUTES].sort()).toEqual(["/admin", ...onDisk].sort());
  });

  it("gives every admin page a purpose and at least one task", () => {
    for (const route of ADMIN_ROUTES) {
      expect(PAGE_HELP[route].purpose.length, route).toBeGreaterThan(20);
      expect(PAGE_HELP[route].tasks.length, route).toBeGreaterThan(0);
    }
  });

  it("shows the help panel on every admin page", () => {
    // Admin home is the exception: its whole lower half is every guide, which
    // makes an "About this page" panel above it a second copy.
    for (const route of ADMIN_ROUTES.filter((r) => r !== "/admin")) {
      const source = readFileSync(pageFile(route), "utf8");
      expect(source, `${route} does not render its help panel`).toContain(
        `<HelpPanel route="${route}"`,
      );
    }
  });

  it("points every page's tasks at guides that exist", () => {
    for (const route of ADMIN_ROUTES) {
      for (const id of PAGE_HELP[route].tasks) {
        expect(guideById(id), `${route} lists missing guide "${id}"`).toBeDefined();
      }
    }
  });
});

describe("guides", () => {
  it("have unique ids in lower-case-with-dashes", () => {
    const ids = GUIDES.map((guide) => guide.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("each sit in a known topic, and every topic has guides", () => {
    for (const guide of GUIDES) expect(TOPICS).toContain(guide.topic);
    for (const topic of TOPICS) {
      expect(GUIDES.some((guide) => guide.topic === topic), topic).toBe(true);
    }
  });

  it("send people only to pages that exist", () => {
    for (const guide of GUIDES) {
      if (guide.page) expect(ADMIN_ROUTES, guide.id).toContain(guide.page);
    }
  });

  it("have steps, in sentence case, with nothing left unfinished", () => {
    for (const guide of GUIDES) {
      expect(guide.steps.length, guide.id).toBeGreaterThan(0);
      expect(guide.title[0], guide.id).toBe(guide.title[0].toUpperCase());
      const text = [guide.title, ...guide.steps, guide.note ?? ""].join(" ");
      expect(text, guide.id).not.toMatch(/\b(TODO|TBD|FIXME|lorem)\b/i);
    }
  });

  it("link outside the app only over https", () => {
    const links = [
      ...GUIDES.flatMap((guide) => (guide.link ? [guide.link] : [])),
      ...Object.values(SETUP_STEP_TEXT).flatMap((text) => (text.link ? [text.link] : [])),
    ];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(new URL(link.href).protocol, link.href).toBe("https:");
  });

  it("are all reachable from some page's help, or from the topic list", () => {
    const listed = new Set(Object.values(PAGE_HELP).flatMap((help) => help.tasks));
    for (const guide of GUIDES) {
      // Every guide is on Admin home's topic list; this catches a guide that
      // belongs to a page but was never listed on it.
      if (guide.page && guide.page !== "/admin") {
        expect(listed.has(guide.id), `${guide.id} is missing from ${guide.page}'s help`).toBe(true);
      }
    }
  });
});

describe("tours", () => {
  /** Every data-tour value written anywhere in the admin pages' source. */
  function markersInSource(dir: string, found = new Set<string>()): Set<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) markersInSource(path, found);
      else if (entry.name.endsWith(".tsx")) {
        const source = readFileSync(path, "utf8");
        for (const match of source.matchAll(/data-tour=(?:"([a-z-]+)"|\{([^}]*)\})/g)) {
          if (match[1]) found.add(match[1]);
          // A computed value, e.g. {kind === "item" ? "menu-items" : "add-ons"}.
          for (const literal of (match[2] ?? "").matchAll(/"([a-z-]+)"/g)) found.add(literal[1]);
        }
      }
    }
    return found;
  }

  it("gives every admin page a tour", () => {
    for (const route of ADMIN_ROUTES) expect(TOURS[route].length, route).toBeGreaterThan(0);
  });

  it("points every step at a marker that exists in the admin pages", () => {
    const markers = markersInSource(ADMIN_DIR);
    for (const route of ADMIN_ROUTES) {
      for (const step of TOURS[route]) {
        expect(markers.has(step.target), `${route}: no data-tour="${step.target}"`).toBe(true);
      }
    }
  });
});

describe("setup checklist wording", () => {
  it("links every step to a guide that exists, and only to real pages", () => {
    for (const [id, text] of Object.entries(SETUP_STEP_TEXT)) {
      expect(guideById(text.guide), id).toBeDefined();
      if (text.action) expect(ADMIN_ROUTES, id).toContain(text.action.href);
    }
  });
});

describe("glossary", () => {
  it("defines each term once", () => {
    const terms = GLOSSARY.map((entry) => entry.term.toLowerCase());
    expect(new Set(terms).size).toBe(terms.length);
  });
});
