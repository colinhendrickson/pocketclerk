/**
 * MenuIcon — the picture staff chose for a menu item or add-on.
 *
 * Decorative (`aria-hidden`): the name beside it is the label, and a screen
 * reader saying "coffee mug, Coffee" helps nobody. Line icons from the same
 * set as the rest of the app, in the current text color, so they sit in the
 * design rather than on top of it. See src/lib/menu-icons.ts for the set.
 */

import {
  Apple,
  Cake,
  Candy,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Cuboid,
  Donut,
  Droplet,
  Droplets,
  Flame,
  GlassWater,
  Leaf,
  Milk,
  MilkOff,
  Popcorn,
  Snowflake,
  createLucideIcon,
  type LucideIcon,
} from "lucide-react";

import type { MenuIconKey } from "@/lib/menu-icons";

/**
 * The coffee mug with a D on it, for decaf. Drawn from Lucide's own mug so the
 * line weight and corners match; the D sits inside the cup.
 */
const Decaf = createLucideIcon("decaf", [
  ["path", { d: "M10 2v2", key: "steam-1" }],
  ["path", { d: "M14 2v2", key: "steam-2" }],
  ["path", { d: "M6 2v2", key: "steam-3" }],
  [
    "path",
    {
      d: "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",
      key: "mug",
    },
  ],
  ["path", { d: "M8 11v6h1.5a3 3 0 0 0 0-6Z", key: "d" }],
]);

const ICONS: Record<MenuIconKey, LucideIcon> = {
  mug: Coffee,
  decaf: Decaf,
  tea: Leaf,
  "cold-drink": CupSoda,
  water: GlassWater,
  milk: Milk,
  "no-dairy": MilkOff,
  cream: Droplets,
  sugar: Cuboid,
  syrup: Droplet,
  ice: Snowflake,
  hot: Flame,
  lemon: Citrus,
  cookie: Cookie,
  donut: Donut,
  cake: Cake,
  pastry: Croissant,
  fruit: Apple,
  candy: Candy,
  popcorn: Popcorn,
};

export interface MenuIconProps {
  icon: MenuIconKey;
  size: number;
  className?: string;
}

export function MenuIcon({ icon, size, className }: MenuIconProps) {
  const Icon = ICONS[icon];
  return <Icon size={size} aria-hidden="true" data-menu-icon={icon} className={className} />;
}
