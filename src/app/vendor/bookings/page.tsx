import type { Metadata } from "next";
import { CalendarClock, Clock, MapPin } from "lucide-react";
import { getVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatDate, timeAgo } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { BookingActionForm } from "@/components/vendor-forms";

export const metadata: Metadata = { title: "Bookings · Vendor dashboard" };

const TONES: Record<string, "success" | "warning" | "info" | "danger" | "neutral"> = {
  requested: "warning",
  confirmed: "success",
  rescheduled: "info",
  completed: "neutral",
  cancelled: "danger",
  no_show: "danger",
};

export default async function VendorBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { store, category } = await getVendorContext();
  const { status = "upcoming" } = await searchParams;

  const params: unknown[] = [store.id];
  let where = "b.store_id = $1";
  if (status === "upcoming") where += " and b.status in ('requested','confirmed','rescheduled') and b.scheduled_date >= current_date - interval '1 day'";
  else if (status === "past") where += " and (b.status in ('completed','no_show') or b.scheduled_date < current_date)";
  else if (status === "requested") where += " and b.status = 'requested'";
  else if (status !== "all") {
    params.push(status);
    where += ` and b.status = $${params.length}`;
  }

  const rows = await systemDb.query<{
    id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    scheduled_date: string;
    scheduled_time: string;
    duration_minutes: number | null;
    location: string | null;
    notes: string | null;
    status: string;
    created_at: string;
    product_name: string | null;
  }>(
    `select b.*, p.name as product_name
       from service_bookings b left join products p on p.id = b.product_id
      where ${where}
      order by b.scheduled_date, b.scheduled_time limit 60`,
    params,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bookings"
        description={
          category?.features?.serviceBooking || category?.features?.appointments
            ? "Appointments customers requested through your storefront booking form."
            : "Appointment requests from your storefront."
        }
      />
      <Tabs
        links={[
          { href: "/vendor/bookings?status=upcoming", label: "Upcoming", active: status === "upcoming" },
          { href: "/vendor/bookings?status=requested", label: "Requests", active: status === "requested" },
          { href: "/vendor/bookings?status=past", label: "Past", active: status === "past" },
          { href: "/vendor/bookings?status=all", label: "All", active: status === "all" },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-5" />}
          title="No bookings"
          description="When a customer books a session, it will appear here for you to confirm."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((booking) => (
            <Card key={booking.id} className="card-pad space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-900">{booking.product_name ?? "Appointment"}</p>
                  <p className="text-sm text-ink-500">{booking.customer_name}</p>
                </div>
                <Badge tone={TONES[booking.status] ?? "neutral"}>{booking.status}</Badge>
              </div>
              <p className="flex items-center gap-2 text-sm text-ink-700">
                <CalendarClock className="size-4 text-brand-600" />
                {formatDate(booking.scheduled_date)} · {booking.scheduled_time}
                {booking.duration_minutes ? <span className="text-ink-400">({booking.duration_minutes} min)</span> : null}
              </p>
              {booking.location ? <p className="flex items-center gap-2 text-sm text-ink-600"><MapPin className="size-4 text-ink-400" /> {booking.location}</p> : null}
              <p className="flex items-center gap-2 text-xs text-ink-400"><Clock className="size-3.5" /> requested {timeAgo(booking.created_at)}</p>
              {booking.notes ? <p className="rounded-lg bg-ink-50 p-2 text-sm text-ink-600">{booking.notes}</p> : null}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <a href={`mailto:${booking.customer_email}`} className="text-xs font-semibold text-brand-700 hover:underline">{booking.customer_email}</a>
                <BookingActionForm bookingId={booking.id} status={booking.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
