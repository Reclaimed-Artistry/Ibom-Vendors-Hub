"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { submitReviewAction, type PublicState } from "@/app/actions/public";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type Action = (prev: PublicState, formData: FormData) => Promise<PublicState>;

export function ReviewForm({
  orderId,
  productId,
  itemLabel,
  compact = false,
}: {
  orderId: string;
  productId?: string | null;
  itemLabel?: string;
  compact?: boolean;
}) {
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState<number | null>(null);
  const [state, action] = useActionState<PublicState, FormData>(submitReviewAction as Action, {});

  if (state?.message) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-sm font-medium text-brand-900">
        <CheckCircle2 className="size-4 shrink-0 text-brand-700" />
        <span>{state.message}</span>
      </div>
    );
  }

  const displayRating = hovered ?? rating;

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-ink-200 bg-white p-4">
      <input type="hidden" name="orderId" value={orderId} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      <input type="hidden" name="rating" value={rating} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink-900">
            {itemLabel ? `Review "${itemLabel}"` : "Leave a verified purchase review"}
          </p>
          <p className="text-xs text-ink-500">Your review will carry a Verified Purchase badge.</p>
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
              className="rounded p-0.5 transition hover:scale-110"
            >
              <Star
                className={`size-5 ${
                  star <= displayRating ? "fill-amber-400 text-amber-400" : "text-ink-200"
                }`}
              />
            </button>
          ))}
          <span className="ml-1 text-xs font-semibold text-ink-700">{rating}/5</span>
        </div>
      </div>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}

      {!compact ? (
        <Field label="Headline (optional)" htmlFor={`review-title-${orderId}-${productId ?? "store"}`} error={state?.fieldErrors?.title}>
          <input
            id={`review-title-${orderId}-${productId ?? "store"}`}
            name="title"
            className="input"
            maxLength={120}
            placeholder="Summarise your experience in a few words"
          />
        </Field>
      ) : null}

      <Field
        label="Your review"
        htmlFor={`review-comment-${orderId}-${productId ?? "store"}`}
        error={state?.fieldErrors?.comment}
        required
      >
        <textarea
          id={`review-comment-${orderId}-${productId ?? "store"}`}
          name="comment"
          rows={compact ? 2 : 3}
          className="textarea"
          required
          minLength={5}
          placeholder="How was the product quality, packaging, and dispatch / pickup experience?"
        />
      </Field>

      <div className="flex justify-end">
        <SubmitButton className="btn-primary btn-sm" pendingLabel="Publishing review…">
          Publish verified review
        </SubmitButton>
      </div>
    </form>
  );
}
