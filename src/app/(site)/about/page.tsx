import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { normalisePhone } from "@/lib/utils";

export const metadata = { title: "About" };

export default async function AboutPage() {
  const settings = await getSettings();
  return (
    <div className="container-page max-w-3xl py-12 prose-site">
      <h1 className="font-display text-3xl">A marketplace built for Akwa Ibom businesses</h1>
      <p>
        {settings.platform_name} gives every serious business in Akwa Ibom its own storefront, on its own address, with the
        tools it actually needs. Restaurants get menus and delivery windows. Shoemakers get made-to-order production tracking.
        Designers get measurements and quotations. Electronics vendors get stock and warranty. Service providers get bookings
        and quotes.
      </p>
      <h2>Why we built it</h2>
      <p>
        Local vendors were losing customers to Instagram DMs and unreliable delivery. Customers had no way to know who was
        genuine, what an order actually cost, or when it would arrive. We built one platform with real storefronts, real
        payments and real tracking.
      </p>
      <h2>How it works</h2>
      <ul className="list-disc pl-5">
        <li>Register your business and choose your category.</li>
        <li>Get an automatic storefront address like <code>yourbusiness.{settings.main_domain}</code>.</li>
        <li>Add products, services and variations that match how you sell.</li>
        <li>Accept orders, update production stages and keep customers informed automatically.</li>
        <li>Stay online with a simple subscription — renew in seconds.</li>
      </ul>
      <h2>Contact</h2>
      <p>
        <a className="underline" href={`mailto:${settings.support_email}`}>{settings.support_email}</a> ·{" "}
        <a className="underline" href={`tel:${normalisePhone(settings.support_phone)}`}>{settings.support_phone}</a>
      </p>
      <p><Link href="/register" className="font-semibold text-brand-800 underline">Open your storefront today</Link>.</p>
    </div>
  );
}
