import assert from "node:assert/strict";
import { Client } from "pg";
import { calculateDeliveryFee, deliveryRate, isWithinVendorLga } from "../src/lib/delivery-fees";
import { productSchema } from "../src/lib/validation";

async function main() {
  const item = (deliveryFee: number | null, quantity = 1, kind = "product") => ({ deliveryFee, quantity, kind });
  assert.equal(calculateDeliveryFee([item(500, 2), item(800)], 1500), 1800);
  assert.equal(calculateDeliveryFee([item(0, 3)], 1500), 0);
  assert.equal(calculateDeliveryFee([item(null, 2), item(null)], 1500), 1500);
  assert.equal(calculateDeliveryFee([item(500, 2), item(null)], 1500), 2500);
  assert.equal(calculateDeliveryFee([item(900, 1, "service")], 1500), 0);
  assert.equal(calculateDeliveryFee([], 1500), 0);
  assert.equal(calculateDeliveryFee([item(25.15, 3)], 1500), 75.45);
  for (const fee of ["", undefined, "0", "1500", "25.15"]) {
    assert(productSchema.safeParse({ name: "Test product", price: 500, deliveryFee: fee }).success);
  }
  for (const fee of ["-1", "1000001", "invalid"]) {
    assert(!productSchema.safeParse({ name: "Test product", price: 500, deliveryFee: fee }).success);
  }
  assert(isWithinVendorLga("Uyo", " uYO ", "Akwa Ibom State"));
  assert(!isWithinVendorLga("Uyo", "Eket", "Akwa Ibom"));
  assert(!isWithinVendorLga("Uyo", "Uyo", "Lagos"));
  assert(!isWithinVendorLga(null, "Uyo", "Akwa Ibom"));
  assert(!isWithinVendorLga("Uyo", "Uyo Village", "Akwa Ibom"));
  assert(isWithinVendorLga("Ikot Ekpene", "Ikot  Ekpene", "Akwa Ibom"));
  assert.equal(deliveryRate(true, 500, 2000), 500);
  assert.equal(deliveryRate(false, 500, 2000), 2000);
  assert.equal(deliveryRate(false, 500, 0), 0);
  assert.equal(deliveryRate(false, 500, null), null);
  for (const within of [true, false]) {
    const items = [{ kind: "product", quantity: 2, deliveryFee: deliveryRate(within, 500, 2000) }, { kind: "product", quantity: 3, deliveryFee: null }];
    assert.equal(calculateDeliveryFee(items, within ? 1000 : 3000), within ? 2000 : 7000);
  }
  for (const fee of ["", undefined, "0", "3000", "25.15"]) assert(productSchema.safeParse({ name: "Test product", price: 500, deliveryFeeOutside: fee }).success);
  for (const fee of ["-1", "1000001", "invalid"]) assert(!productSchema.safeParse({ name: "Test product", price: 500, deliveryFeeOutside: fee }).success);
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres", ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  await db.connect();
  try {
    await db.query("begin");
    const { rows: [product] } = await db.query("select id from products limit 1");
    assert(product, "Seed a product first");
    for (const fee of [0, 725.5, null]) {
      const { rows: [saved] } = await db.query("update products set delivery_fee=$2 where id=$1 returning delivery_fee", [product.id, fee]);
      assert.equal(saved.delivery_fee == null ? null : Number(saved.delivery_fee), fee);
    }
    for (const fee of [0, 3000.5, null]) {
      const { rows: [saved] } = await db.query("update products set delivery_fee_outside=$2 where id=$1 returning delivery_fee_outside", [product.id, fee]);
      assert.equal(saved.delivery_fee_outside == null ? null : Number(saved.delivery_fee_outside), fee);
    }
    const { rows: [store] } = await db.query("select id from stores limit 1");
    const { rows: [savedStore] } = await db.query("update stores set delivery_fee_outside=4200 where id=$1 returning delivery_fee_outside", [store.id]);
    assert.equal(Number(savedStore.delivery_fee_outside), 4200);
    console.log("Delivery fee checks passed: LGA/state matching, within/outside rates, zone fallbacks, persistence, per-unit pricing, free delivery, legacy fallback, mixed carts, services, validation and DB persistence.");
  } finally {
    await db.query("rollback");
    await db.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
