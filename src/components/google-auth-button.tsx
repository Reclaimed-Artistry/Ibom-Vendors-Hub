import { googleConfigured } from "@/lib/google-auth";

/**
 * "Continue with Google".
 *
 * Rendered only when a complete OAuth client is available (saved in Admin ->
 * Platform settings or supplied through GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET),
 * so the product never shows a button that cannot work. It is a plain link: the
 * route generates the CSRF state, sets the cookie and redirects to Google.
 */
export async function GoogleAuthButton({
  label = "Continue with Google",
  next,
}: {
  label?: string;
  next?: string;
}) {
  if (!(await googleConfigured())) return null;
  const href = next ? `/auth/google?next=${encodeURIComponent(next)}` : "/auth/google";
  return (
    <div className="space-y-3">
      <a
        href={href}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-800 transition-colors hover:border-ink-300 hover:bg-ink-50"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87Z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09Z" />
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
        </svg>
        {label}
      </a>
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-ink-400">
        <span className="h-px flex-1 bg-ink-100" />
        or use your email
        <span className="h-px flex-1 bg-ink-100" />
      </div>
    </div>
  );
}
