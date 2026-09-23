import { describe, expect, it } from "vitest";

import { formatFrom } from "@/providers/email/from";
import { escapeHtml, renderSignInEmail } from "@/providers/renderer/sign-in";

const base = {
  name: "Avery Lane",
  code: "008728",
  link: "https://example.test/admin/verify?token=abc&x=1",
  cartName: "Sunrise Snack Cart",
  programName: "Maple Grove Learning Program",
  logoUrl: null,
  expiresMinutes: 15,
};

describe("renderSignInEmail", () => {
  it("puts the code first in the subject, so a lock screen shows it", () => {
    expect(renderSignInEmail(base).subject).toBe(
      "008 728 is your Sunrise Snack Cart sign-in code",
    );
  });

  it("keeps leading zeros everywhere the code appears", () => {
    const { text, html } = renderSignInEmail(base);
    expect(text).toContain("008 728");
    expect(html).toContain("008 728");
  });

  it("names the cart and program in both bodies", () => {
    const { text, html } = renderSignInEmail(base);
    for (const body of [text, html]) {
      expect(body).toContain("Sunrise Snack Cart");
      expect(body).toContain("Maple Grove Learning Program");
    }
  });

  it("states the lifetime it was given, not a hard-coded one", () => {
    const { text, html } = renderSignInEmail({ ...base, expiresMinutes: 7 });
    expect(text).toContain("expires in 7 minutes");
    expect(html).toContain("Expires in 7 minutes");
  });

  it("carries the link intact in the text body and escaped in the HTML", () => {
    const { text, html } = renderSignInEmail(base);
    expect(text).toContain(base.link);
    // `&` in a query string must be `&amp;` inside an attribute, or strict
    // clients truncate the href at the first parameter.
    expect(html).toContain('href="https://example.test/admin/verify?token=abc&amp;x=1"');
  });

  it("escapes names so data cannot become markup", () => {
    const { html } = renderSignInEmail({
      ...base,
      name: '<img src=x onerror="alert(1)">',
      cartName: "Bean & Leaf",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("Bean &amp; Leaf");
  });

  it("shows a logo only when one is configured", () => {
    expect(renderSignInEmail(base).html).not.toContain("<img");
    const withLogo = renderSignInEmail({
      ...base,
      logoUrl: "https://example.test/logo.png",
    }).html;
    expect(withLogo).toContain('src="https://example.test/logo.png"');
    expect(withLogo).toContain('alt="Sunrise Snack Cart"');
  });

  it("gives the inbox preview line the code", () => {
    expect(renderSignInEmail(base).html).toContain(
      "Your code is 008 728. It expires in 15 minutes.",
    );
  });
});

describe("escapeHtml", () => {
  it("escapes the five characters that matter", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("formatFrom", () => {
  it("gives a bare address the cart's name", () => {
    expect(formatFrom("info@example.test", "Sunrise Snack Cart")).toBe(
      '"Sunrise Snack Cart" <info@example.test>',
    );
  });

  it("quotes a name that would otherwise change how the header parses", () => {
    expect(formatFrom("info@example.test", "Bean & Leaf, Inc.")).toBe(
      '"Bean & Leaf, Inc." <info@example.test>',
    );
  });

  it("escapes quotes and backslashes inside the name", () => {
    expect(formatFrom("info@example.test", 'The "Good" \\ Cart')).toBe(
      '"The \\"Good\\" \\\\ Cart" <info@example.test>',
    );
  });

  it("cannot be used to start a new header", () => {
    const from = formatFrom("info@example.test", "Cart\r\nBcc: someone@example.test");
    expect(from).not.toMatch(/[\r\n]/);
  });

  it("respects a display name the deployment already set", () => {
    expect(formatFrom("Front Desk <info@example.test>", "Sunrise Snack Cart")).toBe(
      "Front Desk <info@example.test>",
    );
  });

  it("falls back to the bare address when there is no name to use", () => {
    expect(formatFrom("  info@example.test ", "   ")).toBe("info@example.test");
  });
});
