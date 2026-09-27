/**
 * Fixed set of line icons for menu items and add-ons, for pre-readers. Array
 * order is picker order. Keys are mirrored in a CHECK constraint
 * (drizzle/0012_menu_icons.sql); adding one needs a new migration, and a test
 * compares them. See docs/adr/0015-menu-pictures.md.
 */

export const MENU_ICONS = [
  // Drinks
  { key: "mug", label: "Mug (coffee, hot chocolate)" },
  { key: "decaf", label: "Mug with a D (decaf)" },
  { key: "tea", label: "Leaf (tea)" },
  { key: "cold-drink", label: "Cup with a straw (cold drink)" },
  { key: "water", label: "Glass of water" },
  { key: "milk", label: "Milk" },
  // Add-ons
  { key: "no-dairy", label: "Milk crossed out (no dairy)" },
  { key: "cream", label: "Drops (cream)" },
  { key: "sugar", label: "Sugar cube" },
  { key: "syrup", label: "Drop (syrup, honey)" },
  { key: "ice", label: "Snowflake (iced)" },
  { key: "hot", label: "Flame (hot)" },
  { key: "lemon", label: "Lemon" },
  // Treats
  { key: "cookie", label: "Cookie" },
  { key: "donut", label: "Donut" },
  { key: "cake", label: "Cake" },
  { key: "pastry", label: "Croissant (pastry)" },
  { key: "fruit", label: "Apple (fruit)" },
  { key: "candy", label: "Candy" },
  { key: "popcorn", label: "Popcorn" },
] as const;

export type MenuIconKey = (typeof MENU_ICONS)[number]["key"];

const KEYS: ReadonlySet<string> = new Set(MENU_ICONS.map((icon) => icon.key));

export function isMenuIconKey(value: unknown): value is MenuIconKey {
  return typeof value === "string" && KEYS.has(value);
}

export function menuIconLabel(key: MenuIconKey): string {
  return MENU_ICONS.find((icon) => icon.key === key)?.label ?? key;
}
