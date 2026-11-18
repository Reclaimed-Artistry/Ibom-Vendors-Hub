import assert from "node:assert/strict";
import { Client } from "pg";
import { calculateDeliveryFee } from "../src/lib/delivery-fees";
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
    console.log("Delivery fee checks passed: per-unit pricing, free delivery, legacy fallback, mixed carts, services, validation and DB persistence.");
  } finally {
    await db.query("rollback");
    await db.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
