import { getSettings } from "@/lib/settings";

import { publicMetadata, siteUrl } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Terms of service · Ibom Vendors Hub",
  description: "Read the terms for using Ibom Vendors Hub as a customer or vendor, including storefronts, orders, bookings and marketplace responsibilities.",
  url: siteUrl("/terms"),
});

export default async function TermsPage() {
  const settings = await getSettings();
  const sections = (settings.terms_markdown ?? "").split("\n").filter((line) => line.trim());
  return (
    <div className="container-page max-w-3xl py-12 prose-site">
      <h1 className="font-display text-3xl">Terms of service</h1>
      <p className="text-xs text-ink-400">Last updated {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
      {sections.length === 0 ? <p>The platform administrator has not published terms yet.</p> : null}
      {sections.map((line, index) => {
        if (line.startsWith("## ")) return <h2 key={index}>{line.replace("## ", "")}</h2>;
        if (line.startsWith("# ")) return <h1 key={index}>{line.replace("# ", "")}</h1>;
        if (line.startsWith("- ")) return <li key={index}>{line.replace("- ", "")}</li>;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}
