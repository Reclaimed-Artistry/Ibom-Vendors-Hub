import type { Metadata } from "next";

/** Stable public URLs: search crawlers must not depend on a login or rotating query token. */
export const ORGANIZATION_LOGO = {
  path: "/brand/organization-logo.png",
  width: 1200,
  height: 480,
} as const;

export const FAVICON_SIZES = [16, 32, 48, 96, 256] as const;

export const BRAND_ICONS = {
  icon: [
    { url: "/brand/favicon-96.png", type: "image/png", sizes: "96x96" },
    { url: "/brand/icon-512.png", type: "image/png", sizes: "512x512" },
  ],
  shortcut: "/favicon.ico",
  apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
} satisfies Metadata["icons"];

/** These exact files contain public brand artwork, never user or tenant data. */
export const PUBLIC_BRAND_ASSET_PATHS = [
  "/favicon.ico", "/icon.png", "/apple-icon.png",
  "/brand/favicon-32.png", "/brand/favicon-48.png", "/brand/favicon-96.png",
  "/brand/icon-512.png", ORGANIZATION_LOGO.path,
] as const;
