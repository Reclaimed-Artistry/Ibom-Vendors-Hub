import type { Metadata } from "next";
import { CalendarClock, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { cancelBookingAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "My bookings · Ibom Vendors Hub" };

export default async function AccountBookingsPage() {
  const user = await requireUser(["customer", "vendor", "admin", "super_admin"]);
  const rows = await systemDb.query<{
    id: string;
    scheduled_date: string;
    scheduled_time: string;
    duration_minutes: number | null;
    location: string | null;
    notes: string | null;
    status: string;
    store_name: string;
    store_slug: string;
    product_name: string | null;
  }>(
    `select b.id, b.scheduled_date, b.scheduled_time, b.duration_minutes, b.location, b.notes, b.status,
            s.name as store_name, s.slug as store_slug, p.name as product_name
       from service_bookings b
       join stores s on s.id = b.store_id
       left join products p on p.id = b.product_id
      where lower(b.customer_email) = lower($1)
      order by b.scheduled_date desc limit 50`,
    [user.email],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="My bookings" description="Appointments you requested with vendors." actions={<ButtonLink href="/browse?kind=service" variant="secondary" size="sm">Book a service</ButtonLink>} />
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarClock className="size-5" />} title="No bookings yet" description="Book a session, fitting or consultation from a service storefront." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((booking) => (
            <Card key={booking.id} className="card-pad space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink-900">{booking.product_name ?? "Appointment"}</p>
                  <p className="text-sm text-ink-500">{booking.store_name}</p>
                </div>
                <Badge tone={booking.status === "confirmed" ? "success" : booking.status === "requested" ? "warning" : booking.status === "cancelled" ? "danger" : "neutral"}>{booking.status}</Badge>
              </div>
              <p className="flex items-center gap-2 text-sm text-ink-700">
                <CalendarClock className="size-4 text-brand-600" /> {formatDate(booking.scheduled_date)} · {booking.scheduled_time}
                {booking.duration_minutes ? <span className="text-ink-400">({booking.duration_minutes} min)</span> : null}
              </p>
              {booking.location ? <p className="flex items-center gap-2 text-sm text-ink-600"><MapPin className="size-4 text-ink-400" /> {booking.location}</p> : null}
              {booking.notes ? <p className="rounded-lg bg-ink-50 p-2 text-sm text-ink-600">{booking.notes}</p> : null}
              <div className="flex items-center gap-2 pt-1">
                <ButtonLink href={`/s/${booking.store_slug}`} variant="ghost" size="sm">Visit store</ButtonLink>
                {["requested", "confirmed", "rescheduled"].includes(booking.status) ? (
                  <form action={cancelBookingAction}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <button type="submit" className="btn btn-ghost btn-sm text-red-600">Cancel booking</button>
                  </form>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
