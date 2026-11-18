import type { Metadata } from "next";
import { CalendarClock, Clock, MapPin, Phone, Wrench } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
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

interface BookingDetailsPayload {
  visitType?: string | null;
  materialsOption?: string | null;
  fields?: Array<{ key: string; label: string; value: string }>;
}

export default async function VendorBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { store, category } = await requireActiveVendorContext();
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
    booking_details: BookingDetailsPayload | null;
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
            ? "Site visits, service bookings and appointments submitted through your storefront with full customer requirement details."
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
          description="When a customer books a site visit or service session, all job requirements and address details will appear here."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((booking) => {
            const details = booking.booking_details ?? {};
            const extraFields = Array.isArray(details.fields) ? details.fields : [];
            return (
              <Card key={booking.id} className="card-pad space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{booking.product_name ?? "Service booking"}</p>
                    <p className="text-sm text-ink-600">{booking.customer_name}</p>
                  </div>
                  <Badge tone={TONES[booking.status] ?? "neutral"}>{booking.status}</Badge>
                </div>

                <p className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
                  <CalendarClock className="size-4 shrink-0 text-brand-600" />
                  <span>
                    {formatDate(booking.scheduled_date)} · {booking.scheduled_time} WAT
                  </span>
                  {booking.duration_minutes ? <span className="text-ink-400">({booking.duration_minutes} min)</span> : null}
                </p>

                {booking.location ? (
                  <p className="flex items-start gap-2 text-sm text-ink-700">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" />
                    <span className="break-words">{booking.location}</span>
                  </p>
                ) : null}

                {(details.visitType || details.materialsOption || extraFields.length > 0) ? (
                  <div className="space-y-1.5 rounded-xl border border-brand-100 bg-brand-50/50 p-3 text-xs text-ink-800">
                    <p className="flex items-center gap-1.5 font-semibold text-brand-900">
                      <Wrench className="size-3.5 text-brand-700" /> Booking / inspection details
                    </p>
                    {details.visitType ? (
                      <p>
                        <span className="font-medium text-ink-500">Visit type:</span> {details.visitType}
                      </p>
                    ) : null}
                    {details.materialsOption ? (
                      <p>
                        <span className="font-medium text-ink-500">Materials:</span> {details.materialsOption}
                      </p>
                    ) : null}
                    {extraFields.map((item) => (
                      <p key={item.key}>
                        <span className="font-medium text-ink-500">{item.label}:</span> {item.value}
                      </p>
                    ))}
                  </div>
                ) : null}

                {booking.notes ? <p className="rounded-lg bg-ink-50 p-2.5 text-sm text-ink-600">{booking.notes}</p> : null}

                <p className="flex items-center gap-2 text-xs text-ink-400">
                  <Clock className="size-3.5" /> requested {timeAgo(booking.created_at)}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-2">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {booking.customer_phone ? (
                      <a href={`tel:${booking.customer_phone}`} className="inline-flex items-center gap-1 font-semibold text-ink-800 hover:text-brand-700">
                        <Phone className="size-3.5 text-brand-700" /> {booking.customer_phone}
                      </a>
                    ) : null}
                    <a href={`mailto:${booking.customer_email}`} className="font-semibold text-brand-700 hover:underline">
                      {booking.customer_email}
                    </a>
                  </div>
                  <BookingActionForm bookingId={booking.id} status={booking.status} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
