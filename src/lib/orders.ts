import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  addons,
  menuItems,
  orderItemAddons,
  orderItems,
  orders,
  persons,
  receiptJobs,
  type Addon,
  type MenuItem,
} from "@/db/schema";
import { changeCents, orderTotalCents } from "@/lib/money";
import type { CompleteOrderInput } from "@/lib/validate";

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      totalCents: number;
      changeCents: number;
      /** False when this id was already recorded, i.e. a retry. */
      created: boolean;
    }
  | { ok: false; error: "invalid" | "insufficient" | "unknown_item" };

/**
 * Writes the order, lines, add-ons, and receipt jobs in one transaction.
 * Prices come from active menu rows and the total and change are recomputed
 * here; client arithmetic is never trusted. The cart-chosen order id makes a
 * retry return the recorded order instead of counting the sale twice.
 */
export async function placeOrder(
  shiftId: string,
  input: CompleteOrderInput,
): Promise<PlaceOrderResult> {
  const { orderId, teacherId, receivedCents, lines } = input;

  const existing = await recordedOrder(orderId, shiftId);
  if (existing) return existing;

  const itemIds = [...new Set(lines.map((line) => line.menuItemId))];
  const addonIds = [...new Set(lines.flatMap((line) => line.addonIds))];
  const [menu, extras] = await Promise.all([
    db
      .select()
      .from(menuItems)
      .where(and(inArray(menuItems.id, itemIds), eq(menuItems.active, true))),
    addonIds.length === 0
      ? Promise.resolve([] as Addon[])
      : db
          .select()
          .from(addons)
          .where(and(inArray(addons.id, addonIds), eq(addons.active, true))),
  ]);
  const menuById = new Map(menu.map((m) => [m.id, m]));
  const addonById = new Map(extras.map((a) => [a.id, a]));

  const priced: { item: MenuItem; qty: number; addons: Addon[] }[] = [];
  for (const line of lines) {
    const item = menuById.get(line.menuItemId);
    const chosen = line.addonIds.map((id) => addonById.get(id));
    if (!item || !chosen.every((addon): addon is Addon => addon !== undefined)) {
      return { ok: false, error: "unknown_item" };
    }
    priced.push({ item, qty: line.qty, addons: chosen });
  }

  const totalCents = orderTotalCents(
    priced.map((p) => ({
      unitPriceCents: p.item.priceCents,
      qty: p.qty,
      addonPriceCents: p.addons.map((a) => a.priceCents),
    })),
  );
  if (receivedCents < totalCents) return { ok: false, error: "insufficient" };
  const change = changeCents(totalCents, receivedCents);

  const created = await db.transaction(async (tx) => {
    // A concurrent retry with the same id waits on the primary key, then does nothing.
    const [order] = await tx
      .insert(orders)
      .values({
        id: orderId,
        shiftId,
        teacherId,
        totalCents,
        paymentMethod: "cash",
        receivedCents,
        changeCents: change,
      })
      .onConflictDoNothing({ target: orders.id })
      .returning({ id: orders.id });
    if (!order) return false;

    for (const line of priced) {
      const [row] = await tx
        .insert(orderItems)
        .values({
          orderId: order.id,
          menuItemId: line.item.id,
          nameSnapshot: line.item.name,
          qty: line.qty,
          unitPriceCents: line.item.priceCents,
        })
        .returning({ id: orderItems.id });

      if (line.addons.length > 0) {
        await tx.insert(orderItemAddons).values(
          line.addons.map((addon) => ({
            orderItemId: row.id,
            addonId: addon.id,
            nameSnapshot: addon.name,
            priceCents: addon.priceCents,
          })),
        );
      }
    }

    // Receipts are queued with the sale and delivered asynchronously, so a
    // printer or network failure never blocks an order. See
    // docs/adr/0002-receipt-job-queue.md.
    await tx.insert(receiptJobs).values({ orderId: order.id, channel: "print" });

    // No email job for a teacher without an email address.
    const [teacher] = await tx
      .select({ email: persons.email })
      .from(persons)
      .where(eq(persons.id, teacherId));
    if (teacher?.email) {
      await tx.insert(receiptJobs).values({ orderId: order.id, channel: "email" });
    }
    return true;
  });

  if (!created) return (await recordedOrder(orderId, shiftId)) ?? { ok: false, error: "invalid" };
  return { ok: true, orderId, totalCents, changeCents: change, created: true };
}

/** The recorded result for an order id, or an error if another shift owns it. */
async function recordedOrder(
  orderId: string,
  shiftId: string,
): Promise<PlaceOrderResult | null> {
  const [row] = await db
    .select({
      shiftId: orders.shiftId,
      totalCents: orders.totalCents,
      changeCents: orders.changeCents,
    })
    .from(orders)
    .where(eq(orders.id, orderId));
  if (!row) return null;
  if (row.shiftId !== shiftId) return { ok: false, error: "invalid" };
  return {
    ok: true,
    orderId,
    totalCents: row.totalCents,
    changeCents: row.changeCents ?? 0,
    created: false,
  };
}
