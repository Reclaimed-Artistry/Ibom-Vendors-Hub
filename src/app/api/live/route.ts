import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Cheap liveness fingerprint the dashboard polls to know when to re-render.
 *
 * Returns the caller's unread-notification count + the newest notification
 * timestamp, and for vendors also the store/subscription state so an admin
 * action like a subscription waiver (or a restore, expiry or manual
 * suspension) shows up on the vendor's open dashboard without a manual
 * refresh. The client calls `router.refresh()` when any field changes.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const unread = await systemDb.maybeOne<{ count: number; latest: string | null }>(
    `select count(*)::int as count, max(created_at)::text as latest
       from notifications
      where user_id = $1 and read_at is null`,
    [user.id],
  );

  let vendorState: string | null = null;
  if (user.role === "vendor") {
    const store = await systemDb.maybeOne<{
      id: string;
      status: string;
      access_until: string | null;
      manual_suspension: boolean | null;
    }>(
      `select id, status, access_until, manual_suspension from stores where owner_id = $1 order by created_at limit 1`,
      [user.id],
    );
    if (store) {
      const subscription = await systemDb.maybeOne<{ expires_at: string | null }>(
        `select expires_at::text from subscriptions
          where store_id = $1 and status in ('trialing','active') and expires_at > now()
          order by expires_at desc limit 1`,
        [store.id],
      );
      vendorState = [
        store.status,
        store.access_until ?? "",
        store.manual_suspension ? "1" : "0",
        subscription?.expires_at ?? "",
      ].join("|");
    }
  }

  return NextResponse.json(
    {
      unread: unread?.count ?? 0,
      latest: unread?.latest ?? null,
      vendorState,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
