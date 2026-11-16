/**
 * Creates the first platform administrator on a fresh deployment.
 *
 * Safe to run on every deploy: it does nothing when an administrator already
 * exists, and it never overwrites an existing password.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' tsx scripts/bootstrap-admin.ts
 */
import { systemDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    console.log("bootstrap-admin: ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping.");
    return;
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const existingAdmins = await systemDb.query<{ id: string }>(
    `select id from users where role in ('admin','super_admin') limit 1`,
  );
  if (existingAdmins.length > 0) {
    console.log("bootstrap-admin: an administrator already exists — nothing to do.");
    return;
  }

  const hash = await hashPassword(password);
  const user = await systemDb.maybeOne<{ id: string }>(`select id from users where lower(email) = $1`, [email]);

  if (user) {
    await systemDb.execute(
      `update users set role = 'super_admin', status = 'active', password_hash = $2, email_verified_at = coalesce(email_verified_at, now()) where id = $1`,
      [user.id, hash],
    );
    console.log(`bootstrap-admin: promoted ${email} to super_admin.`);
  } else {
    await systemDb.execute(
      `insert into users (email, password_hash, full_name, role, status, email_verified_at)
       values ($1,$2,$3,'super_admin','active', now())`,
      [email, hash, "Platform Admin"],
    );
    console.log(`bootstrap-admin: created super_admin ${email}.`);
  }

  await systemDb.execute(
    `insert into activity_logs (actor_role, action, entity_type, description)
     values ('system','admin.bootstrap','user',$1)`,
    [email],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("bootstrap-admin failed:", error);
    process.exit(1);
  });
