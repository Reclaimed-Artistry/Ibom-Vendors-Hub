"use client";

import { useActionState, useState } from "react";
import { Eye, Send, Sparkles } from "lucide-react";
import {
  createPlatformAnnouncementAction,
  createStoreAnnouncementAction,
  type AnnouncementState,
} from "@/app/actions/announcements";
import { ANNOUNCEMENT_STYLES } from "@/lib/announcement-style";
import { ANNOUNCEMENT_KINDS, type AnnouncementKind } from "@/lib/announcement-kinds";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

interface ProductOption {
  id: string;
  name: string;
}

function Preview({ kind, title, message }: { kind: AnnouncementKind; title: string; message: string }) {
  const style = ANNOUNCEMENT_STYLES[kind] ?? ANNOUNCEMENT_STYLES.info;
  const Icon = style.icon;
  return (
    <div className={cn("overflow-hidden rounded-lg", style.bar)}>
      <div className="ivh-marquee flex w-max items-center gap-2 py-2 pl-4 text-[13px]" style={{ animationDuration: "16s" }}>
        {[0, 1].map((copy) => (
          <span key={copy} className="inline-flex items-center gap-2 whitespace-nowrap" aria-hidden={copy === 1}>
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-80">{style.label}</span>
            <span className="font-semibold">{title || "Your headline"}</span>
            <span className="opacity-90">{message || "and the detail that scrolls after it…"}</span>
            <span className="px-6 opacity-40">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnnouncementComposer({
  mode,
  products = [],
}: {
  mode: "platform" | "store";
  products?: ProductOption[];
}) {
  const [state, formAction] = useActionState<AnnouncementState, FormData>(
    mode === "platform" ? createPlatformAnnouncementAction : createStoreAnnouncementAction,
    {},
  );
  const [kind, setKind] = useState<AnnouncementKind>(mode === "platform" ? "info" : "flash_sale");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const toggleProduct = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.length >= 12 ? current : [...current, id],
    );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
          <Eye className="size-3.5" /> Live preview
        </p>
        <Preview kind={kind} title={title} message={message} />
        <p className="text-xs text-ink-500">This is exactly how it crosses the top of the screen — right to left, under the header.</p>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-800">Type</p>
        <div className="flex flex-wrap gap-1.5">
          {(mode === "platform" ? ANNOUNCEMENT_KINDS : ANNOUNCEMENT_KINDS.filter((k) => ["flash_sale", "clearance", "info", "success"].includes(k.value))).map(
            (option) => {
              const active = kind === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  title={option.hint}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "border-brand-600 bg-brand-50 text-brand-800"
                      : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
                  )}
                >
                  {option.label}
                </button>
              );
            },
          )}
        </div>
        <input type="hidden" name="kind" value={kind} />
      </div>

      {mode === "platform" ? (
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-800">Show this to</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { value: "vendors", label: "Vendors", hint: "Everyone selling on the hub" },
              { value: "customers", label: "Customers", hint: "Shoppers on every storefront" },
              { value: "everyone", label: "Both", hint: "Vendors and shoppers" },
            ].map((option, index) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-ink-200 bg-white p-2.5 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
              >
                <input
                  type="radio"
                  name="audience"
                  value={option.value}
                  defaultChecked={index === 0}
                  className="mt-0.5 accent-brand-700"
                />
                <span>
                  <span className="block font-medium text-ink-900">{option.label}</span>
                  <span className="block text-xs text-ink-500">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <input type="hidden" name="audience" value="customers" />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Headline" htmlFor="ann-title" hint={`${title.length}/80`} required>
          <input
            id="ann-title"
            name="title"
            className="input"
            maxLength={80}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={mode === "platform" ? "Subscription renewals resume Monday" : "48-hour flash sale"}
          />
        </Field>
        <Field label="Ends (optional)" htmlFor="ann-ends" hint="The strip stops on its own.">
          <input id="ann-ends" name="endsAt" type="datetime-local" className="input" />
        </Field>
      </div>

      <Field label="Detail" htmlFor="ann-message" hint={`${message.length}/220`} required>
        <textarea
          id="ann-message"
          name="message"
          className="textarea"
          rows={2}
          maxLength={220}
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={mode === "platform" ? "Payments settle as usual — no action needed." : "Fresh pepper soup spices at 30% off while stock lasts."}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Button label (optional)" htmlFor="ann-cta" hint="Shown when a link is set.">
          <input id="ann-cta" name="ctaLabel" className="input" maxLength={30} placeholder="Shop the sale" />
        </Field>
        <Field label="Link (optional)" htmlFor="ann-link" hint="A path like /deals or a full https:// link.">
          <input id="ann-link" name="linkUrl" className="input" placeholder="/s/your-store/products" />
        </Field>
      </div>

      {mode === "store" ? (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-800">
            <Sparkles className="size-4 text-brand-600" /> Products to flash
            <span className="text-xs font-normal text-ink-500">({selected.length}/12 — they scroll with the message)</span>
          </p>
          {products.length ? (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-ink-200 bg-white p-2">
              {products.map((product) => (
                <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-ink-50">
                  <input
                    type="checkbox"
                    name="productIds"
                    value={product.id}
                    checked={selected.includes(product.id)}
                    onChange={() => toggleProduct(product.id)}
                    className="accent-brand-700"
                  />
                  <span className="truncate text-ink-800">{product.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-ink-200 bg-ink-50 p-3 text-sm text-ink-500">
              Add a product to your catalogue first and it will show up here to select.
            </p>
          )}
        </div>
      ) : null}

      <SubmitButton className="btn btn-primary" pendingLabel="Publishing…">
        <Send className="size-3.5" /> {mode === "platform" ? "Publish announcement" : "Flash it to customers"}
      </SubmitButton>
    </form>
  );
}
