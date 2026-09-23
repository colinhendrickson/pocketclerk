import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { logoSvg } from "@/lib/logo";

/**
 * The committed icon files are renders of src/lib/logo.ts. If the mark changes
 * and scripts/render-icons.ts is not re-run, the favicon would quietly show
 * the old one; this fails instead.
 */

const root = process.cwd();

describe("icon files", () => {
  it("icon.svg is exactly the current mark", () => {
    const committed = readFileSync(join(root, "src/app/icon.svg"), "utf8").replace(/\r\n/g, "\n");
    expect(committed).toBe(logoSvg());
  });

  it("favicon.ico is a real icon file holding 16, 32 and 48px images", () => {
    const ico = readFileSync(join(root, "src/app/favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico.readUInt8(6 + i * 16));
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("every icon the manifest names exists", () => {
    for (const icon of manifest().icons ?? []) {
      expect(existsSync(join(root, "public", icon.src)), icon.src).toBe(true);
    }
    expect(existsSync(join(root, "src/app/apple-icon.png"))).toBe(true);
  });
});
