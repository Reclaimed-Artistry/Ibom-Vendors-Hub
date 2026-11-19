import Link from "next/link";
import { ArrowRight, CheckCircle2, Store } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { publicMetadata, siteUrl } from "@/lib/seo";
import { breadcrumbStructuredData } from "@/lib/structured-data";

export const metadata = publicMetadata({
  title: "Sell Online in Akwa Ibom — Free Storefront · Ibom Vendors Hub",
  description: "Open a free online store for your Akwa Ibom business. List products, accept service bookings and manage orders with your own Ibom Vendors Hub storefront address.",
  url: siteUrl("/sell"),
});

const faqs = [
  { question: "Is registering and owning a store free?", answer: "Yes. Registering and owning a store on Ibomvendorshub is absolutely free. No trial countdown or subscription payment is required." },
  { question: "Who can open a storefront?", answer: "Businesses in Akwa Ibom, Nigeria can apply. Create an account, provide your business and verification details, and choose the category that matches what you sell. Your storefront becomes public after approval." },
  { question: "What can I sell or offer?", answer: "You can list products or services in the available business categories, including food, fashion, electronics, beauty, agriculture and professional services. Category-specific tools support catalogues, bookings, made-to-order work and quotations where applicable." },
  { question: "Will my business have its own website address?", answer: "Yes. Approved storefronts have a unique address such as yourbusiness.ibomvendorshub.com, which you can share with customers." },
];

export default function SellPage() {
  return (
    <div className="container-page max-w-4xl py-12">
      <JsonLd data={breadcrumbStructuredData([{ name: "Ibom Vendors Hub", url: siteUrl() }, { name: "Sell online", url: siteUrl("/sell") }])} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) }} />
      <div className="rounded-3xl bg-ink-900 p-7 text-white sm:p-12">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-200"><Store className="size-4" /> Built for local businesses</p>
        <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">Sell online in Akwa Ibom with your own free storefront</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-200">Bring your products and services to customers in Uyo and across Akwa Ibom. Ibom Vendors Hub gives your business a shareable storefront, a catalogue and the tools to manage customer orders in one place.</p>
        <p className="mt-4 text-sm font-semibold text-brand-200">Registering and owning a store is absolutely free. No trial countdown or subscription payment is required.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/register" className="btn-gold">Create your free storefront <ArrowRight className="size-4" /></Link>
          <Link href="/stores" className="btn-secondary">Explore existing vendors</Link>
        </div>
      </div>
      <section className="py-10">
        <h2 className="font-display text-2xl text-ink-900">From your business to your customers</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            ["1. Create an account", "Sign in or register, then enter your business name, location and verification details."],
            ["2. Build your catalogue", "Choose your category and add product photos, descriptions, prices or service details."],
            ["3. Share your storefront", "After approval, share your unique address and manage enquiries, bookings and orders."],
          ].map(([title, text]) => <li key={title} className="card p-5"><CheckCircle2 className="size-5 text-brand-700" /><h3 className="mt-3 text-sm font-bold text-ink-900">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-600">{text}</p></li>)}
        </ol>
      </section>
      <section>
        <h2 className="font-display text-2xl text-ink-900">Questions about selling on Ibom Vendors Hub</h2>
        <dl className="mt-5 divide-y divide-ink-100">
          {faqs.map((faq) => <div key={faq.question} className="py-5"><dt className="text-base font-semibold text-ink-900">{faq.question}</dt><dd className="mt-2 text-sm leading-7 text-ink-600">{faq.answer}</dd></div>)}
        </dl>
        <p className="mt-5 text-sm text-ink-600">Need help? <Link href="/contact" className="font-semibold text-brand-800 underline">Contact our support team</Link> or <Link href="/browse" className="font-semibold text-brand-800 underline">browse the marketplace</Link>.</p>
      </section>
    </div>
  );
}
