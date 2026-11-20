/** Local database regression test. All inserted bookings are rolled back. */
import assert from "node:assert/strict";
import { Client } from "pg";
import { bookingSchema } from "../src/lib/validation";

async function main() {
  const input = {
    productId: "11111111-1111-4111-8111-111111111111",
    customerName: "Booking Test", customerEmail: "booking-test@example.com",
    customerPhone: "08031234567", date: "2026-12-20", time: "10:00",
    requirementsAccepted: true, notes: "Bridal makeup appointment",
  };
  assert(!bookingSchema.safeParse(input).success, "meeting choice is required");
  assert(!bookingSchema.safeParse({ ...input, meetingPreference: "invalid" }).success);
  assert(!bookingSchema.safeParse({ ...input, meetingPreference: "customer_location", location: "" }).success, "mobile appointments require an address");
  assert(!bookingSchema.safeParse({ ...input, meetingPreference: "customer_location", location: "    " }).success);
  assert(bookingSchema.safeParse({ ...input, meetingPreference: "vendor_location" }).success, "office appointments do not require the customer's address");
  assert(!bookingSchema.safeParse({ ...input, meetingPreference: "vendor_location", requirementsAccepted: false }).success);
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres", ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  await db.connect();
  try {
    await db.query("begin");
    const { rows: [service] } = await db.query(`select p.id, p.store_id from products p join stores s on s.id = p.store_id where p.kind = 'service' and p.is_available and s.status = 'active' limit 1`);
    assert(service, "seed an active professional service before testing");
    for (const meetingPreference of ["customer_location", "vendor_location"] as const) {
      const data = bookingSchema.parse({ ...input, productId: service.id, meetingPreference, location: meetingPreference === "customer_location" ? "10 Test Road, Uyo, near plaza" : "" });
      const details = { requirementsAccepted: true, fields: [{ key: "meeting_preference", label: "Service meeting location", value: meetingPreference }] };
      const { rows: [booking] } = await db.query(`insert into service_bookings (store_id, product_id, customer_name, customer_email, customer_phone, scheduled_date, scheduled_time, location, notes, booking_details, status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'requested') returning *`, [service.store_id, service.id, data.customerName, data.customerEmail, data.customerPhone, data.date, data.time, data.location, data.notes, JSON.stringify(details)]);
      assert.equal(booking.status, "requested");
      assert.equal(booking.location, data.location);
      assert.equal(booking.booking_details.fields[0].value, meetingPreference);
      assert.equal(booking.notes, input.notes);
    }
    console.log("Service booking regression checks passed: meeting choices, required address, consent and database persistence.");
  } finally {
    await db.query("rollback");
    await db.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
