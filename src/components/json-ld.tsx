import { serializeJsonLd } from "@/lib/seo";

/** Server-rendered and escaped: vendor-supplied text cannot end the script. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
