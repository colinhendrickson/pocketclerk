/**
 * Renders every icon file from the one drawing of the mark in src/lib/logo.ts.
 *
 *   pnpm exec tsx scripts/render-icons.ts
 *
 * Run it after changing the mark, and commit what it writes:
 *
 *   src/app/icon.svg        the favicon, for every browser that takes SVG
 *   src/app/favicon.ico     16, 32 and 48px, for everything else
 *   src/app/apple-icon.png  180px, square: iOS rounds home-screen icons itself
 *   public/icon-192.png     the web app manifest's icons, for "Add to Home
 *   public/icon-512.png     Screen" on the cart's iPad
 *
 * Next.js serves the src/app files by name and writes the <link> tags itself.
 * Rendering uses the Chromium Playwright already installs for the tests.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

import { logoSvg } from "../src/lib/logo";

const root = join(__dirname, "..");

async function render(svg: string, size: number): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    await page.setContent(
      `<body style="margin:0;background:transparent"><img src="${src}" width="${size}" height="${size}" style="display:block"></body>`,
    );
    await page.locator("img").evaluate((img: HTMLImageElement) => img.decode());
    return await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  } finally {
    await browser.close();
  }
}

/** An .ico holding PNG images, which every current browser reads. */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

async function main() {
  const rounded = logoSvg();
  const square = logoSvg({ fullBleed: true });

  writeFileSync(join(root, "src/app/icon.svg"), rounded);

  const small = await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await render(rounded, size) })));
  writeFileSync(join(root, "src/app/favicon.ico"), ico(small));

  writeFileSync(join(root, "src/app/apple-icon.png"), await render(square, 180));
  writeFileSync(join(root, "public/icon-192.png"), await render(rounded, 192));
  writeFileSync(join(root, "public/icon-512.png"), await render(rounded, 512));

  console.log("Wrote icon.svg, favicon.ico, apple-icon.png, icon-192.png and icon-512.png.");
}

void main();
