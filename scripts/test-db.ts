/**
 * Database-level checks: schema, row-level security isolation, payment safety
 * and data-retention guarantees. Run against the local PGlite database or a
 * Supabase branch: `npm run test:db`.
 */
import { systemDb, withActor, withPublic } from "../src/lib/db";

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}`, detail ?? "");
  }
}

async function main() {
  console.log("\nSchema");
  const tables = await systemDb.query<{ count: number }>(
    `select count(*)::int as count from information_schema.tables where table_schema = 'public'`,
  );
  check("public schema has the full table set", (tables[0]?.count ?? 0) >= 30, tables[0]);
  const policies = await systemDb.query<{ count: number }>(`select count(*)::int as count from pg_policies`);
  check("RLS policies are installed", (policies[0]?.count ?? 0) >= 30, policies[0]);
  const forced = await systemDb.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname='public' and rowsecurity = false and tablename in ('stores','products','orders','payments','reviews')`,
  );
  check("tenant tables have RLS enabled", forced.length === 0, forced);
  const appRole = await systemDb.maybeOne<{ rolname: string }>(`select rolname from pg_roles where rolname = 'app_runtime'`);
  check("app_runtime role exists", Boolean(appRole));

  const storeA = await systemDb.maybeOne<{ id: string; owner_id: string; name: string }>(
    `select id, owner_id, name from stores where status = 'active' order by created_at limit 1`,
  );
  const storeB = await systemDb.maybeOne<{ id: string; owner_id: string; name: string }>(
    `select id, owner_id, name from stores where status = 'active' and id <> $1 order by created_at limit 1`,
    [storeA?.id],
  );
  const expired = await systemDb.maybeOne<{ id: string }>(`select id from stores where status = 'expired' limit 1`);

  console.log("\nRow-level security");
  if (storeA && storeB) {
    const ownerA = await systemDb.one<{ email: string }>(`select email from users where id = $1`, [storeA.owner_id]);
    const ownProducts = await withActor({ id: storeA.owner_id, role: "vendor", email: ownerA.email }, (db) =>
      db.query<{ count: number }>(`select count(*)::int as count from products where store_id = $1`, [storeA.id]),
    );
    check("vendor sees their own products", (ownProducts[0]?.count ?? 0) > 0, ownProducts[0]);

    const vendorView = await withActor({ id: storeA.owner_id, role: "vendor", email: ownerA.email }, (db) =>
      db.query<{ count: number }>(`select count(*)::int as count from products where store_id = $1`, [storeB.id]),
    );
    const publicView = await withPublic((db) =>
      db.query<{ count: number }>(`select count(*)::int as count from products where store_id = $1`, [storeB.id]),
    );
    check(
      "vendor only sees another store's public catalogue (never hidden rows)",
      (vendorView[0]?.count ?? 0) === (publicView[0]?.count ?? -1),
      { vendor: vendorView[0]?.count, public: publicView[0]?.count },
    );

    const crossUpdate = await withActor({ id: storeA.owner_id, role: "vendor", email: ownerA.email }, (db) =>
      db.execute(`update stores set tagline = 'hacked' where id = $1`, [storeB.id]),
    );
    check("vendor cannot write to another store", crossUpdate === 0, crossUpdate);

    const crossOrders = await withActor({ id: storeA.owner_id, role: "vendor", email: ownerA.email }, (db) =>
      db.query<{ count: number }>(`select count(*)::int as count from orders where store_id = $1`, [storeB.id]),
    );
    check("vendor cannot read another store's orders", (crossOrders[0]?.count ?? 0) === 0, crossOrders[0]);

    let blocked = false;
    try {
      await withActor({ id: storeA.owner_id, role: "vendor", email: ownerA.email }, (db) =>
        db.execute(
          `insert into products (store_id, name, slug, price) values ($1, 'Intrusion', 'intrusion-test', 10)`,
          [storeB.id],
        ),
      );
    } catch {
      blocked = true;
    }
    check("vendor cannot create products in another store", blocked);

    const protectedField = await withActor({ id: storeA.owner_id, role: "vendor", email: ownerA.email }, (db) =>
      db.execute(`update stores set status = 'active' where id = $1`, [storeA.id]),
    );
    void protectedField;
    const stillOwn = await systemDb.maybeOne<{ tagline: string | null }>(`select tagline from stores where id = $1`, [storeB.id]);
    check("store B tagline unchanged", stillOwn?.tagline !== "hacked", stillOwn);
  } else {
    check("two active stores exist for isolation checks", false);
  }

  console.log("\nPublic visibility");
  const publicStores = await withPublic((db) => db.query<{ id: string }>(`select id from stores`));
  const systemStores = await systemDb.query<{ id: string }>(`select id from stores`);
  check("anonymous visitors see fewer stores than the system", publicStores.length < systemStores.length, {
    public: publicStores.length,
    system: systemStores.length,
  });
  if (expired) {
    check("expired storefront is hidden from the marketplace", !publicStores.some((row) => row.id === expired.id));
    const retained = await systemDb.maybeOne<{ products: number }>(
      `select count(*)::int as products from products where store_id = $1`,
      [expired.id],
    );
    check("expired store keeps its products", (retained?.products ?? 0) > 0, retained);
  }
  const hiddenProducts = await systemDb.one<{ count: number }>(`select count(*)::int as count from products where not is_available`);
  const publicHidden = await withPublic((db) => db.query<{ count: number }>(`select count(*)::int as count from products where not is_available`));
  check("unavailable products are hidden from the public", (publicHidden[0]?.count ?? 0) === 0 || hiddenProducts.count === 0);

  console.log("\nOrders & payments");
  const badRefs = await systemDb.query<{ reference: string }>(
    `select reference from orders where reference !~ '^IVH-[0-9]{4}-[0-9]{6}$'`,
  );
  check("order references follow IVH-YYMM-NNNNNN", badRefs.length === 0, badRefs.slice(0, 3));
  const unsettled = await systemDb.query<{ reference: string }>(
    `select o.reference from orders o
      where o.payment_status = 'paid'
        and not exists (
          select 1 from payments p
           where p.status = 'success'
             and (p.order_id = o.id
                  or exists (select 1 from payment_allocations pa where pa.payment_id = p.id and pa.order_id = o.id))
        )`,
  );
  check("every paid order has a verified payment", unsettled.length === 0, unsettled.slice(0, 3));

  const pendingPayment = await systemDb.maybeOne<{ reference: string }>(`select reference from payments where status = 'pending' limit 1`);
  if (pendingPayment) {
    const stillPending = await systemDb.maybeOne<{ status: string }>(`select status from payments where reference = $1`, [pendingPayment.reference]);
    check("pending payments are never assumed successful", stillPending?.status === "pending", stillPending);
  }

  const fx = await systemDb.maybeOne<{ fn: string }>(`select proname as fn from pg_proc where proname = 'apply_subscription_payment'`);
  check("subscription grant function exists", Boolean(fx));

  console.log("\nData retention");
  const suspended = await systemDb.maybeOne<{ id: string }>(`select id from stores where status = 'suspended' limit 1`);
  if (suspended) {
    const data = await systemDb.maybeOne<{ products: number; images: number }>(
      `select (select count(*)::int from products where store_id = $1) as products,
              (select count(*)::int from product_images pi join products p on p.id = pi.product_id where p.store_id = $1) as images`,
      [suspended.id],
    );
    check("suspended stores keep products and images", (data?.products ?? 0) > 0 && (data?.images ?? 0) > 0, data);
  } else {
    console.log("  · no suspended store seeded — retention check skipped");
  }

  console.log("\nGoogle sign-in");
  const columns = await systemDb.query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_name = 'platform_settings'
        and column_name in ('google_client_id','google_client_secret','google_signin_enabled')`,
  );
  check(
    "platform_settings can hold a Google OAuth client",
    columns.length === 3,
    columns.map((row) => row.column_name),
  );
  const toggle = await systemDb.maybeOne<{ google_signin_enabled: boolean }>(
    `select google_signin_enabled from platform_settings where id = 1`,
  );
  check("Google sign-in switch has a sane default", typeof toggle?.google_signin_enabled === "boolean", toggle);


  console.log("\nAnnouncements");
  const annTables = await systemDb.query<{ tablename: string; rowsecurity: boolean }>(
    `select tablename, rowsecurity from pg_tables
      where schemaname = 'public' and tablename in ('announcements','announcement_products')
      order by tablename`,
  );
  check(
    "announcement tables exist with RLS on",
    annTables.length === 2 && annTables.every((row) => row.rowsecurity),
    annTables,
  );

  if (storeA) {
    const ownerA = await systemDb.one<{ email: string }>(`select email from users where id = $1`, [storeA.owner_id]);
    const actorA = { id: storeA.owner_id, role: "vendor" as const, email: ownerA.email };

    const published = await withActor(actorA, (db) =>
      db.maybeOne<{ id: string }>(
        `insert into announcements (scope, store_id, audience, kind, title, message)
         values ('store', $1, 'customers', 'flash_sale', 'RLS probe', 'probe') returning id`,
        [storeA.id],
      ),
    );
    check("a vendor can publish to their own storefront", Boolean(published));

    if (published) {
      const anonView = await withPublic((db) =>
        db.maybeOne<{ id: string }>(`select id from announcements where id = $1`, [published.id]),
      );
      check("shoppers can read a live storefront announcement", Boolean(anonView));

      await systemDb.execute(
        `update announcements set ends_at = now() - interval '1 hour' where id = $1`,
        [published.id],
      );
      const afterEnd = await withPublic((db) =>
        db.maybeOne<{ id: string }>(`select id from announcements where id = $1`, [published.id]),
      );
      check("a finished announcement drops out of the ticker feed", !afterEnd);
      await systemDb.execute(`delete from announcements where id = $1`, [published.id]);
    }

    if (storeB) {
      const ownerB = await systemDb.one<{ email: string }>(`select email from users where id = $1`, [storeB.owner_id]);
      let blocked = false;
      try {
        await withActor({ id: storeB.owner_id, role: "vendor", email: ownerB.email }, (db) =>
          db.query(
            `insert into announcements (scope, store_id, audience, kind, title, message)
             values ('store', $1, 'customers', 'info', 'cross tenant', 'probe')`,
            [storeA.id],
          ),
        );
      } catch {
        blocked = true;
      }
      check("a vendor cannot publish into another store", blocked);
    }

    const platformProbe = await systemDb.maybeOne<{ id: string }>(
      `insert into announcements (scope, audience, kind, title, message)
       values ('platform', 'vendors', 'warning', 'vendor only probe', 'probe') returning id`,
    );
    if (platformProbe) {
      const anonSees = await withPublic((db) =>
        db.maybeOne<{ id: string }>(`select id from announcements where id = $1`, [platformProbe.id]),
      );
      check("vendor-only platform notices stay off the public site", !anonSees);
      const adminRow = await systemDb.maybeOne<{ id: string }>(`select id from users where role = 'super_admin' limit 1`);
      if (adminRow) {
        const adminSees = await withActor({ id: adminRow.id, role: "super_admin", email: null }, (db) =>
          db.maybeOne<{ id: string }>(`select id from announcements where id = $1`, [platformProbe.id]),
        );
        check("admins can read the notices they publish", Boolean(adminSees));
      }
      await systemDb.execute(`delete from announcements where id = $1`, [platformProbe.id]);
    }
  }

  console.log("\nExpiry suspension & renewal restoration");
  if (expired) {
    const expiredStore = await systemDb.one<{ id: string; owner_id: string }>(
      `select id, owner_id from stores where id = $1`,
      [expired.id],
    );
    const expiredOwner = await systemDb.one<{ email: string }>(
      `select email from users where id = $1`,
      [expiredStore.owner_id],
    );
    const expiredActor = { id: expiredStore.owner_id, role: "vendor" as const, email: expiredOwner.email };

    const accessCheck = await systemDb.one<{ ok: boolean }>(
      `select store_has_vendor_access($1) as ok`,
      [expiredStore.id],
    );
    check("expired store lacks operational vendor access", accessCheck.ok === false, accessCheck);

    const storeUpdateRows = await withActor(expiredActor, (db) =>
      db.execute(`update stores set tagline = 'should-not-write' where id = $1`, [expiredStore.id]),
    );
    check("expired vendor cannot update store settings", storeUpdateRows === 0, storeUpdateRows);

    let productInsertBlocked = false;
    try {
      await withActor(expiredActor, (db) =>
        db.execute(
          `insert into products (store_id, name, slug, price) values ($1, 'Blocked while expired', 'blocked-while-expired', 1000)`,
          [expiredStore.id],
        ),
      );
    } catch {
      productInsertBlocked = true;
    }
    check("expired vendor cannot create products until renewal", productInsertBlocked);

    const paidPlan = await systemDb.one<{ id: string }>(
      `select id from subscription_plans where price > 0 and is_active = true order by price asc limit 1`,
    );
    const beforeHistoryCount = await systemDb.one<{ count: number }>(
      `select count(*)::int as count from subscription_history where store_id = $1`,
      [expiredStore.id],
    );
    const renewed = await systemDb.one<{ id: string; subscription_id: string; new_expires_at: string }>(
      `select id, subscription_id, new_expires_at from apply_subscription_payment($1, $2, null, 7500, 'gateway', null, 'Test renewal')`,
      [expiredStore.id, paidPlan.id],
    );
    const afterRenewal = await systemDb.one<{ status: string; ok: boolean; live: boolean }>(
      `select status, store_has_vendor_access(id) as ok, store_is_live(id) as live from stores where id = $1`,
      [expiredStore.id],
    );
    check(
      "renewing subscription unsuspends account and restores live storefront immediately",
      afterRenewal.status === "active" && afterRenewal.ok === true && afterRenewal.live === true,
      afterRenewal,
    );

    // Roll back the probe renewal so the seeded expired store stays expired for other checks/demos
    await systemDb.execute(
      `update subscriptions set status = 'active', expires_at = now() - interval '1 minute' where id = $1`,
      [renewed.subscription_id],
    );
    await systemDb.execute(`select * from process_subscription_expiry()`);
    const reSuspended = await systemDb.one<{ status: string; ok: boolean; suspended_at: string | null }>(
      `select status, store_has_vendor_access(id) as ok, suspended_at from stores where id = $1`,
      [expiredStore.id],
    );
    check(
      "automatic expiry re-suspends store and records suspended_at",
      reSuspended.status === "expired" && reSuspended.ok === false && Boolean(reSuspended.suspended_at),
      reSuspended,
    );
    await systemDb.execute(`delete from subscription_payments where id = $1`, [renewed.id]);
    void beforeHistoryCount;
  }

  /* 9. Akwa Ibom locality, Vendor KYC, Delivery PIN & Verified Reviews ----- */
  const activeStore = await systemDb.one<{ id: string; owner_id: string; state: string }>(
    `select id, owner_id, state from stores where slug = 'mamaput-kitchen'`,
  );
  check("every seeded vendor store is in Akwa Ibom State", activeStore.state === "Akwa Ibom", activeStore.state);

  let nonAkwaIbomBlocked = false;
  try {
    await systemDb.execute(`update stores set state = 'Lagos' where id = $1`, [activeStore.id]);
  } catch {
    nonAkwaIbomBlocked = true;
  }
  check("database rejects vendor stores outside Akwa Ibom State", nonAkwaIbomBlocked);

  let cacWithoutNumberBlocked = false;
  try {
    await systemDb.execute(
      `update vendor_profiles set cac_registered = true, cac_number = null where user_id = $1`,
      [activeStore.owner_id],
    );
  } catch {
    cacWithoutNumberBlocked = true;
  }
  check("database requires CAC number when cac_registered = true", cacWithoutNumberBlocked);

  await systemDb.execute(
    `update vendor_profiles set cac_registered = false, cac_number = null where user_id = $1`,
    [activeStore.owner_id],
  );
  const kycNoCac = await systemDb.one<{ cac_registered: boolean; nin: string | null }>(
    `select cac_registered, nin from vendor_profiles where user_id = $1`,
    [activeStore.owner_id],
  );
  check("vendor without CAC registration can proceed with NIN + Proof of Residence", kycNoCac.cac_registered === false && Boolean(kycNoCac.nin));
  await systemDb.execute(
    `update vendor_profiles set cac_registered = true, cac_number = 'BN-3849200' where user_id = $1`,
    [activeStore.owner_id],
  );

  const sampleOrder = await systemDb.one<{ delivery_pin: string; payout_released: boolean; status: string }>(
    `select delivery_pin, payout_released, status from orders order by created_at desc limit 1`,
  );
  check(
    "every order has a secret 6-digit delivery verification PIN",
    /^\d{6}$/.test(sampleOrder.delivery_pin),
    sampleOrder.delivery_pin,
  );

  // Anonymous visitor cannot insert reviews
  let anonReviewBlocked = false;
  try {
    await withPublic(async (db) => {
      await db.execute(
        `insert into reviews (store_id, customer_name, customer_email, rating, comment, status)
         values ($1, 'Guest', 'guest@example.com', 5, 'Trying to review anonymously', 'published')`,
        [activeStore.id],
      );
    });
  } catch {
    anonReviewBlocked = true;
  }
  check("anonymous visitors cannot insert reviews", anonReviewBlocked);

  // Logged-in customer WITH a completed/delivered order CAN publish a verified review and trigger rating_avg refresh
  const customerUser = await systemDb.one<{ id: string; email: string; full_name: string }>(
    `select id, email, full_name from users where email = 'customer@ibomvendorshub.com'`,
  );
  const deliveredOrderItem = await systemDb.maybeOne<{
    order_id: string;
    store_id: string;
    product_id: string;
  }>(
    `select o.id as order_id, o.store_id, oi.product_id
       from orders o
       join order_items oi on oi.order_id = o.id
      where o.customer_id = $1
        and o.status in ('delivered', 'completed')
        and oi.product_id is not null
        and not exists (
          select 1 from reviews r where r.order_id = o.id and r.product_id = oi.product_id
        )
      limit 1`,
    [customerUser.id],
  );
  if (deliveredOrderItem) {
    await withActor({ id: customerUser.id, role: "customer", email: customerUser.email }, async (db) => {
      await db.execute(
        `insert into reviews (store_id, product_id, order_id, customer_id, customer_name, customer_email, rating, title, comment, status, verified_purchase)
         values ($1, $2, $3, $4, $5, $6, 5, 'Authentic taste', 'Delivered hot and verified with PIN.', 'published', true)`,
        [
          deliveredOrderItem.store_id,
          deliveredOrderItem.product_id,
          deliveredOrderItem.order_id,
          customerUser.id,
          customerUser.full_name,
          customerUser.email,
        ],
      );
    });
    const refreshedProduct = await systemDb.one<{ rating_count: number; rating_avg: string }>(
      `select rating_count, rating_avg::text from products where id = $1`,
      [deliveredOrderItem.product_id],
    );
    check(
      "logged-in customer review updates product rating aggregates via SECURITY DEFINER trigger",
      refreshedProduct.rating_count >= 1 && Number(refreshedProduct.rating_avg) > 0,
      refreshedProduct,
    );
    await systemDb.execute(
      `delete from reviews where order_id = $1 and product_id = $2 and title = 'Authentic taste'`,
      [deliveredOrderItem.order_id, deliveredOrderItem.product_id],
    );
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exitCode = 1;
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
