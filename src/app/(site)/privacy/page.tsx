import { getSettings } from "@/lib/settings";

export const metadata = { title: "Privacy policy" };

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
