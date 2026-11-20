import { withSystem } from "@/lib/db";
import { markOrdersPaid } from "@/lib/orders";
import { logActivity } from "@/lib/audit";

export async function payWithWalletCheckout(input: {
  userId: string;
  email: string;
  checkoutReference: string;
  grandTotal: number;
}) {
  return withSystem(async (db) => {
    // Never trust a browser-supplied amount or checkout reference ownership.
    const payment = await db.maybeOne<{ id: string; reference: string; amount: number; status: string }>(
      `select id,reference,amount,status from payments where checkout_reference=$1 and payer_user_id=$2 and provider='wallet' and scope='order' for update`,
      [input.checkoutReference, input.userId],
    );
    if (!payment) throw new Error("Wallet checkout not found or does not belong to you.");
    if (payment.status === "success") return { payment, alreadyPaid: true };
    if (payment.status !== "pending") throw new Error("This checkout is no longer payable.");
    const orders = await db.query<{ total: number; customer_id: string; payment_status: string; status: string }>(`select total,customer_id,payment_status,status from orders where checkout_reference=$1 for update`, [input.checkoutReference]);
    const total = Number(orders.reduce((sum, order) => sum + Number(order.total), 0).toFixed(2));
    if (!orders.length || total <= 0 || total !== Number(payment.amount) || orders.some((order) => order.customer_id !== input.userId || order.payment_status !== "pending" || ["cancelled","rejected"].includes(order.status))) throw new Error("This checkout cannot be paid. Please review your orders.");

    // Lock the wallet row so concurrent top-ups/payments can't race.
    const wallet = await db.maybeOne<{ id: string; balance: number }>(
      `select id, balance from wallets where user_id = $1 for update`,
      [input.userId],
    );
    if (!wallet || Number(wallet.balance) < total) {
      throw new Error("Insufficient wallet balance. Choose bank transfer instead.");
    }

    // Mark all orders in this checkout as paid (reuses commission/allocation logic).
    await markOrdersPaid(db, input.checkoutReference, payment.id, "wallet");

    await db.execute(`update payments set status='success',channel='wallet',paid_at=now(),verified_at=now() where id=$1`, [payment.id]);

    // Debit the wallet.
    await db.execute(
      `update wallets set balance = balance - $1, updated_at = now() where id = $2`,
      [total, wallet.id],
    );
    await db.execute(
      `insert into wallet_transactions (wallet_id, type, amount, reference, description, status)
       values ($1,'debit',$2,$3,$4,'success')`,
      [
        wallet.id,
        total,
        payment.reference,
        `Paid for order checkout ${input.checkoutReference} with wallet balance`,
      ],
    );

    await logActivity(
      {
        actorId: input.userId,
        actorRole: "customer",
        storeId: null,
        action: "wallet.debited",
        entityType: "wallet",
        entityId: wallet.id,
        description: `Paid ₦${total.toLocaleString()} from wallet for checkout ${input.checkoutReference}`,
        meta: { amount: total, checkoutReference: input.checkoutReference, paymentId: payment.id },
      },
      db,
    );

    return { payment, wallet };
  });
}

