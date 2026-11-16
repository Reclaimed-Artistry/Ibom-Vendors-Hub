import { getVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { workflowLabel } from "@/lib/storefront";

function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const { store, category } = await getVendorContext();
  const rows = await systemDb.query<{
    reference: string;
    created_at: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    status: string;
    payment_status: string;
    fulfilment_type: string;
    subtotal: number;
    delivery_fee: number;
    total: number;
    platform_commission: number;
    vendor_payable: number;
  }>(
    `select reference, created_at, customer_name, customer_email, customer_phone, status, payment_status,
            fulfilment_type, subtotal, delivery_fee, total, platform_commission, vendor_payable
       from orders where store_id = $1 order by created_at desc`,
    [store.id],
  );

  const header = [
    "Reference",
    "Date",
    "Customer",
    "Email",
    "Phone",
    "Workflow stage",
    "Payment",
    "Fulfilment",
    "Subtotal",
    "Delivery",
    "Total",
    "Platform commission",
    "Vendor payable",
  ];
  const lines = [header.map(cell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.reference,
        new Date(row.created_at).toISOString(),
        row.customer_name,
        row.customer_email,
        row.customer_phone,
        workflowLabel(category, row.status),
        row.payment_status,
        row.fulfilment_type,
        row.subtotal,
        row.delivery_fee,
        row.total,
        row.platform_commission,
        row.vendor_payable,
      ]
        .map(cell)
        .join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${store.slug}-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
