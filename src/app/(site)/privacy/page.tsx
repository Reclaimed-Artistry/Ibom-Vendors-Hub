import { getSettings } from "@/lib/settings";

import { publicMetadata, siteUrl } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Privacy policy · Ibom Vendors Hub",
  description: "Learn how Ibom Vendors Hub handles personal information for customer accounts, vendor storefronts, orders and support.",
  url: siteUrl("/privacy"),
});

export default async function PrivacyPage() {
  const settings = await getSettings();
  const sections = (settings.privacy_markdown ?? "").split("\n").filter((line) => line.trim());
  return (
    <div className="container-page max-w-3xl py-12 prose-site">
      <h1 className="font-display text-3xl">Privacy policy</h1>
      <p className="text-xs text-ink-400">Last updated {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
      {sections.length === 0 ? <p>The platform administrator has not published a privacy policy yet.</p> : null}
      {sections.map((line, index) => {
        if (line.startsWith("## ")) return <h2 key={index}>{line.replace("## ", "")}</h2>;
        if (line.startsWith("# ")) return <h1 key={index}>{line.replace("# ", "")}</h1>;
        if (line.startsWith("- ")) return <li key={index}>{line.replace("- ", "")}</li>;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}
