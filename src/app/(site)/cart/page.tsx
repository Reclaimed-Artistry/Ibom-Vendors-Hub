import { CartView } from "@/components/cart-view";

export const metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl text-ink-900">Your cart</h1>
      <p className="mt-1 text-sm text-ink-500">Items from multiple vendors are split into separate orders, paid in one transaction.</p>
      <div className="mt-6"><CartView /></div>
    </div>
  );
}
