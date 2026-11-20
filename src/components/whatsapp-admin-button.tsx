"use client";

import Link from "next/link";

/**
 * Floating WhatsApp button that lets vendors chat the platform admin.
 * Number: +2348110767707
 */
export function WhatsAppAdminButton() {
  const text = encodeURIComponent(
    "Hello Ibom Vendors Hub admin, I need help with my vendor storefront. " +
      "Please assist me.",
  );
  return (
    <Link
      href={`https://wa.me/2348110767707?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed right-4 bottom-4 z-50 rounded-full bg-green-500 px-3 py-2 text-white text-sm font-semibold shadow-lg hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      aria-label="Chat admin on WhatsApp"
    >
      <svg
        className="size-5 shrink-0 text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 2.44 7.88A22.8 22.8 0 0 1 22 16.92z" />
      </svg>
      <span className="ml-2 hidden sm:inline">WhatsApp admin</span>
    </Link>
  );
}
