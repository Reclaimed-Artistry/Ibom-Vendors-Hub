import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withSystem } from "../src/lib/db";
import { notify } from "../src/lib/notifications";

async function main() {
  assert(!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1"), "Local test database only");
  delete process.env.SMTP_HOST;
  delete process.env.ADMIN_NOTIFICATION_COPY_EMAILS;
  const rollback = new Error("rollback fixtures");
  try { await withSystem(async (db) => {
    const admin = await db.one<{ id: string; email: string }>("select id,email from users where role in ('admin','super_admin') and status='active' limit 1");
    const customer = await db.one<{ id: string }>("select id from users where role='customer' limit 1");
    const key = `email-test-${randomUUID()}`;
    const input = { userId: admin.id, type: "test", title: "Email mirror test", body: "Test notification body", actionUrl: "/admin/notifications", dedupeKey: key };
    await notify(input);
    await notify(input);
    const emails = await db.query<{ to_email: string; html: string; text: string }>("select to_email,html,text from email_logs where template='admin_notification' and payload->>'subject'='Email mirror test'");
    const recipients = new Set([admin.email.toLowerCase(), "victorgodwininyang@gmail.com"]);
    assert.equal(emails.length, recipients.size, "each recipient receives one email, not duplicates");
    for (const email of emails) {
      assert(recipients.has(email.to_email));
      assert(email.html.includes("Test notification body"));
      assert(email.html.includes("/admin/notifications"));
    }
    await notify({ ...input, userId: customer.id, dedupeKey: `${key}-customer` });
    assert.equal((await db.query("select id from email_logs where template='admin_notification' and payload->>'subject'='Email mirror test'")).length, emails.length, "private customer alerts are not copied");
    console.log("Notification email checks passed: admin account + personal copy, deduplication, body/link rendering and customer privacy.");
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 50));
